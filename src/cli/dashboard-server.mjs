import http from "node:http";

// Local read-only web view of registered projects. Binds to loopback by
// default; reach it from another machine with an SSH tunnel.
export const DEFAULT_DASHBOARD_PORT = 7788;
export const DEFAULT_DASHBOARD_BIND = "127.0.0.1";

export function createDashboardServer({ collect, listRoots, readDocument }) {
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method !== "GET") {
      response.writeHead(405, { allow: "GET" }).end();
      return;
    }
    if (url.pathname === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      response.end(renderDashboardHtml());
      return;
    }
    if (url.pathname === "/api/dashboard") {
      try {
        const body = JSON.stringify(collect());
        response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        response.end(body);
      } catch (error) {
        response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
      }
      return;
    }
    if (url.pathname === "/api/doc") {
      const root = url.searchParams.get("project");
      const file = url.searchParams.get("name");
      const known = typeof root === "string" && (listRoots?.() ?? []).includes(root);
      const doc = known ? readDocument(root, file) : null;
      if (!doc) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(JSON.stringify(doc));
      return;
    }
    response.writeHead(404).end();
  });
}

export function startDashboardServer({ collect, listRoots, readDocument, bind = DEFAULT_DASHBOARD_BIND, port = DEFAULT_DASHBOARD_PORT }) {
  const server = createDashboardServer({ collect, listRoots, readDocument });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, bind, () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}

export function renderDashboardHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dove 科研面板</title>
<style>
:root {
  --bg: #f6f7f4; --panel: #ffffff; --ink: #1f2a2e; --muted: #66737a; --line: #e2e6e1;
  --accent: #4f7a3a; --accent-soft: #e6efdf; --warn: #a36a12; --warn-soft: #f8ecd7;
  --done: #3c6e91; --done-soft: #e1ecf4; --pause: #7a7f85; --pause-soft: #eceeef;
  --mentor: #6b4fa0; --mentor-soft: #ece6f6; --user: #b04a3a; --user-soft: #f7e3df;
  --external: #2f7f7a; --external-soft: #dff0ee; --code: #f1f3ef; --shadow: 0 1px 2px rgba(20,30,20,.06);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #151a1c; --panel: #1d2427; --ink: #e5ebe8; --muted: #93a19c; --line: #2c3539;
    --accent: #8fbf74; --accent-soft: #263321; --warn: #e0a64a; --warn-soft: #3a2e1b;
    --done: #7fb2d6; --done-soft: #1f2e39; --pause: #a3a8ad; --pause-soft: #2a2f33;
    --mentor: #b9a3e6; --mentor-soft: #2c2540; --user: #ec8f7f; --user-soft: #3b2420;
    --external: #79cfc7; --external-soft: #1c3533; --code: #232b2e; --shadow: none;
  }
}
:root[data-theme="dark"] {
  --bg: #151a1c; --panel: #1d2427; --ink: #e5ebe8; --muted: #93a19c; --line: #2c3539;
  --accent: #8fbf74; --accent-soft: #263321; --warn: #e0a64a; --warn-soft: #3a2e1b;
  --done: #7fb2d6; --done-soft: #1f2e39; --pause: #a3a8ad; --pause-soft: #2a2f33;
  --mentor: #b9a3e6; --mentor-soft: #2c2540; --user: #ec8f7f; --user-soft: #3b2420;
  --external: #79cfc7; --external-soft: #1c3533; --code: #232b2e; --shadow: none;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.6 -apple-system, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif; }
header.top { display: flex; align-items: center; gap: 12px; padding: 10px 20px; border-bottom: 1px solid var(--line); background: var(--panel); position: sticky; top: 0; z-index: 5; }
header.top .brand { font-weight: 700; font-size: 16px; }
header.top .meta { color: var(--muted); font-size: 12px; margin-left: auto; }
header.top button { background: none; border: 1px solid var(--line); color: var(--ink); border-radius: 6px; padding: 3px 9px; cursor: pointer; font: inherit; font-size: 12px; }
.layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); min-height: calc(100vh - 49px); }
aside { border-right: 1px solid var(--line); padding: 14px; overflow-y: auto; }
.project { display: block; width: 100%; text-align: left; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; cursor: pointer; color: inherit; font: inherit; box-shadow: var(--shadow); }
.project.active { border-color: var(--accent); outline: 2px solid var(--accent-soft); }
.project .row { display: flex; align-items: center; gap: 8px; }
.project .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.project .main { color: var(--muted); font-size: 12.5px; margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.project .foot { color: var(--muted); font-size: 12px; margin-top: 6px; display: flex; justify-content: space-between; gap: 8px; }
.chip { display: inline-block; font-size: 11.5px; padding: 1px 8px; border-radius: 999px; white-space: nowrap; font-weight: 600; }
.chip.ongoing { background: var(--accent-soft); color: var(--accent); }
.chip.paused { background: var(--pause-soft); color: var(--pause); }
.chip.completed { background: var(--done-soft); color: var(--done); }
.chip.none { background: var(--warn-soft); color: var(--warn); }
.chip.mentor { background: var(--mentor-soft); color: var(--mentor); }
.chip.user { background: var(--user-soft); color: var(--user); }
.chip.external { background: var(--external-soft); color: var(--external); }
.chip.other { background: var(--pause-soft); color: var(--pause); }
main { padding: 20px 28px 60px; min-width: 0; }
.empty { color: var(--muted); padding: 40px 0; }
h1.title { margin: 0; font-size: 22px; }
.path { color: var(--muted); font-size: 12px; font-family: ui-monospace, Menlo, monospace; }
.mainline { margin: 12px 0 18px; padding: 12px 14px; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; font-size: 15px; box-shadow: var(--shadow); }
.mainline .label { color: var(--muted); font-size: 12px; display: block; margin-bottom: 2px; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 22px; }
.tile { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; box-shadow: var(--shadow); min-width: 0; }
.tile .k { color: var(--muted); font-size: 12px; }
.tile .v { font-size: 16px; font-weight: 600; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
section { margin-bottom: 26px; }
section > h2 { font-size: 15px; margin: 0 0 10px; display: flex; align-items: baseline; gap: 8px; }
section > h2 .sub { color: var(--muted); font-size: 12px; font-weight: 400; }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; box-shadow: var(--shadow); }
.tablewrap { overflow-x: auto; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; margin-bottom: 10px; box-shadow: var(--shadow); }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { padding: 6px 10px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; white-space: nowrap; }
th { position: sticky; top: 0; background: var(--panel); color: var(--muted); font-weight: 600; }
tr.latest td { background: var(--accent-soft); }
td.num { font-variant-numeric: tabular-nums; }
.round { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; margin-bottom: 10px; box-shadow: var(--shadow); }
.round .head { display: flex; align-items: center; gap: 10px; padding: 10px 14px; flex-wrap: wrap; }
.round .no { font-weight: 700; }
.round .rtitle { flex: 1 1 200px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.round .time { color: var(--muted); font-size: 12px; }
.round .tabs { display: flex; gap: 6px; }
.round .tabs button { border: 1px solid var(--line); background: none; color: var(--ink); border-radius: 6px; padding: 2px 9px; font: inherit; font-size: 12px; cursor: pointer; }
.round .tabs button.on { background: var(--ink); color: var(--panel); border-color: var(--ink); }
.round .tabs button:disabled { opacity: .45; cursor: default; }
.round .body { border-top: 1px solid var(--line); padding: 12px 16px; }
.round.current { border-color: var(--accent); }
.md h1, .md h2, .md h3, .md h4 { font-size: 14.5px; margin: 14px 0 6px; }
.md p { margin: 6px 0; }
.md ul, .md ol { margin: 6px 0; padding-left: 22px; }
.md code { background: var(--code); padding: 1px 5px; border-radius: 4px; font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; }
.md pre { background: var(--code); padding: 10px 12px; border-radius: 8px; overflow-x: auto; }
.md pre code { background: none; padding: 0; }
.md blockquote { margin: 6px 0; padding-left: 10px; border-left: 3px solid var(--line); color: var(--muted); }
.md table { margin: 8px 0; }
details summary { cursor: pointer; color: var(--muted); }
.note { color: var(--muted); font-size: 12px; margin-top: 6px; }
select.mobile { display: none; }
@media (max-width: 820px) {
  .layout { grid-template-columns: 1fr; }
  aside { display: none; }
  select.mobile { display: block; width: calc(100% - 32px); margin: 12px 16px 0; padding: 8px; font: inherit; background: var(--panel); color: var(--ink); border: 1px solid var(--line); border-radius: 8px; }
  main { padding: 16px; }
}
</style>
</head>
<body>
<header class="top">
  <span class="brand">🕊 Dove 科研面板</span>
  <span class="meta" id="meta">加载中…</span>
  <button id="theme" title="切换明暗">明/暗</button>
  <button id="reload">刷新</button>
</header>
<select class="mobile" id="picker" aria-label="选择项目"></select>
<div class="layout">
  <aside id="list"></aside>
  <main id="view"><div class="empty">加载中…</div></main>
</div>
<script>
const STATUS = { ongoing: ["ongoing", "进行中"], "进行中": ["ongoing", "进行中"], paused: ["paused", "已暂停"], "暂停": ["paused", "已暂停"], completed: ["completed", "已完成"], "完成": ["completed", "已完成"] };
const AUTHOR = { mentor: "导师", user: "用户", external: "外部", other: "其他" };
let data = null;
let selected = decodeURIComponent(location.hash.slice(1)) || null;
const open = new Map();

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function ago(ms) {
  if (!ms) return "无记录";
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 90) return "刚刚";
  if (s < 3600) return Math.round(s / 60) + " 分钟前";
  if (s < 86400 * 2) return Math.round(s / 3600) + " 小时前";
  return Math.round(s / 86400) + " 天前";
}
function statusChip(status) {
  const hit = status ? STATUS[String(status).trim().toLowerCase()] || STATUS[String(status).trim()] : null;
  return hit ? '<span class="chip ' + hit[0] + '">' + hit[1] + '</span>' : '<span class="chip none">无进行中轮次</span>';
}
function authorChip(author) {
  return author ? '<span class="chip ' + author + '">' + AUTHOR[author] + '</span>' : '<span class="chip other">未标作者</span>';
}
function inline(text) {
  return esc(text)
    .replace(/\`([^\`]+)\`/g, "<code>$1</code>")
    .replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1</strong>")
    .replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, "$1");
}
function md(text) {
  const lines = String(text || "").split(/\\r?\\n/);
  let html = "", list = null, para = [], i = 0;
  const flush = () => { if (para.length) { html += "<p>" + inline(para.join(" ")) + "</p>"; para = []; } if (list) { html += "</" + list + ">"; list = null; } };
  while (i < lines.length) {
    const line = lines[i];
    if (/^\\s*\`\`\`/.test(line)) {
      flush(); const buf = []; i++;
      while (i < lines.length && !/^\\s*\`\`\`/.test(lines[i])) buf.push(lines[i++]);
      html += "<pre><code>" + esc(buf.join("\\n")) + "</code></pre>"; i++; continue;
    }
    if (/^\\s*\\|.*\\|\\s*$/.test(line)) {
      flush(); const rows = [];
      while (i < lines.length && /^\\s*\\|.*\\|\\s*$/.test(lines[i])) rows.push(lines[i++]);
      html += tableHtml(rows.map((r) => r.trim().replace(/^\\|/, "").replace(/\\|$/, "").split("|").map((c) => c.trim())).filter((r) => !r.every((c) => /^:?-+:?$/.test(c))), false, true);
      continue;
    }
    let m;
    if ((m = line.match(/^(#{1,6})\\s+(.*)$/))) { flush(); html += "<h4>" + inline(m[2]) + "</h4>"; }
    else if ((m = line.match(/^\\s*[-*+]\\s+(.*)$/))) { if (para.length) { html += "<p>" + inline(para.join(" ")) + "</p>"; para = []; } if (list !== "ul") { if (list) html += "</" + list + ">"; html += "<ul>"; list = "ul"; } html += "<li>" + inline(m[1]) + "</li>"; }
    else if ((m = line.match(/^\\s*\\d+[.)]\\s+(.*)$/))) { if (para.length) { html += "<p>" + inline(para.join(" ")) + "</p>"; para = []; } if (list !== "ol") { if (list) html += "</" + list + ">"; html += "<ol>"; list = "ol"; } html += "<li>" + inline(m[1]) + "</li>"; }
    else if ((m = line.match(/^>\\s?(.*)$/))) { flush(); html += "<blockquote>" + inline(m[1]) + "</blockquote>"; }
    else if (!line.trim()) flush();
    else { if (list) { html += "</" + list + ">"; list = null; } para.push(line.trim()); }
    i++;
  }
  flush();
  return html;
}
function tableHtml(rows, highlightLast, plain) {
  if (!rows.length) return "";
  const [head, ...body] = rows;
  const cell = (c) => '<td class="' + (/^[-+]?[\\d.,%]+\\s*\\S{0,3}$/.test(c) ? "num" : "") + '">' + inline(c) + "</td>";
  const tr = body.map((r, idx) => '<tr class="' + (highlightLast && idx === body.length - 1 ? "latest" : "") + '">' + r.map(cell).join("") + "</tr>").join("");
  const t = "<table><thead><tr>" + head.map((c) => "<th>" + inline(c) + "</th>").join("") + "</tr></thead><tbody>" + tr + "</tbody></table>";
  return plain ? '<div class="tablewrap">' + t + "</div>" : t;
}
function renderList() {
  const list = document.getElementById("list");
  const picker = document.getElementById("picker");
  list.innerHTML = data.projects.map((p) =>
    '<button class="project' + (p.root === selected ? " active" : "") + '" data-root="' + esc(p.root) + '">' +
      '<div class="row"><span class="name">' + esc(p.name) + "</span>" + statusChip(p.roundStatus) + "</div>" +
      '<div class="main">' + esc(p.mainline || "未写主线") + "</div>" +
      '<div class="foot"><span>' + esc(p.currentRound || "—") + "</span><span>" + ago(p.lastActivity) + "</span></div>" +
    "</button>").join("") || '<div class="empty">没有已登记且有研究记录的项目。</div>';
  list.querySelectorAll(".project").forEach((el) => el.addEventListener("click", () => select(el.dataset.root)));
  picker.innerHTML = data.projects.map((p) => '<option value="' + esc(p.root) + '"' + (p.root === selected ? " selected" : "") + ">" + esc(p.name) + "</option>").join("");
}
function renderView() {
  const view = document.getElementById("view");
  const p = data.projects.find((item) => item.root === selected);
  if (!p) { view.innerHTML = '<div class="empty">从左侧选择一个项目。</div>'; return; }
  const evalRows = p.evaluation ? p.evaluation.tables.reduce((n, t) => n + t.rows.length, 0) : 0;
  let html = '<h1 class="title">' + esc(p.name) + '</h1><div class="path">' + esc(p.root) + "</div>";
  html += '<div class="mainline"><span class="label">主线</span>' + esc(p.mainline || "身份卡里还没有 Mainline。") + "</div>";
  html += '<div class="tiles">' +
    tile("当前轮次", p.currentRound || "—") + tile("轮次状态", (STATUS[String(p.roundStatus || "").toLowerCase()] || [0, p.roundStatus || "—"])[1]) +
    tile("已有轮次", p.rounds.length) + tile("评测记录", evalRows ? evalRows + " 行" : "—") + tile("最近更新", ago(p.lastActivity)) + "</div>";
  html += '<section><h2>评测表 <span class="sub">EVAL.md · 最新一行高亮</span></h2>';
  if (!p.evaluation) html += '<div class="card note">还没有 EVAL.md。立项确认后由导师定评测。</div>';
  else if (p.evaluation.tables.length) html += p.evaluation.tables.map((t) => '<div class="tablewrap">' + tableHtml([t.header, ...t.rows], true) + "</div>").join("") + lazyDoc(p.root, "EVAL.md", "查看 EVAL.md 原文");
  else html += '<div class="card md">' + md(p.evaluation.text) + "</div>";
  html += "</section>";
  html += '<section><h2>轮次 <span class="sub">rounds/ · 新的在上</span></h2>';
  if (!p.rounds.length) html += '<div class="card note">还没有轮次记录。</div>';
  html += p.rounds.map((r) => {
    const key = p.root + "#" + r.number;
    const which = open.get(key);
    const current = p.currentRound && p.currentRound.includes(r.label);
    return '<div class="round' + (current ? " current" : "") + '"><div class="head">' +
      '<span class="no">第 ' + esc(r.label) + " 轮</span>" + authorChip(r.author) +
      '<span class="rtitle">' + esc(r.title || "") + "</span>" +
      (r.result ? "" : '<span class="chip ' + (current ? "ongoing" : "none") + '">' + (current ? "进行中" : "未出结果") + "</span>") +
      '<span class="time">' + ago((r.result || r.brief || {}).mtime) + "</span>" +
      '<span class="tabs"><button data-key="' + esc(key) + '" data-root="' + esc(p.root) + '" data-file="' + esc(r.brief ? r.brief.file : "") + '" data-which="brief"' + (r.brief ? "" : " disabled") + (which === "brief" ? ' class="on"' : "") + ">说明</button>" +
      '<button data-key="' + esc(key) + '" data-root="' + esc(p.root) + '" data-file="' + esc(r.result ? r.result.file : "") + '" data-which="result"' + (r.result ? "" : " disabled") + (which === "result" ? ' class="on"' : "") + ">结果</button></span></div>" +
      (which && r[which] ? roundBody(p.root, r[which]) : "") + "</div>";
  }).join("");
  html += "</section>";
  html += '<section><h2>身份卡 <span class="sub">IDENTITY.md</span></h2><div class="card md">' + (p.identity ? md(p.identity.text) + (p.identity.text.length > 4096 ? '<div class="note">身份卡超过 4KB，宿主只会看到开头部分。</div>' : "") : '<span class="note">还没有身份卡。</span>') + "</div></section>";
  if (p.doctor) html += "<section>" + lazyDoc(p.root, "DOCTOR.md", "Dove 集成问题记录（DOCTOR.md）") + "</section>";
  view.innerHTML = html;
  view.querySelectorAll("details[data-name]").forEach((d) => d.addEventListener("toggle", () => {
    const key = d.dataset.root + "/" + d.dataset.name;
    if (d.open) { openDocs.add(key); loadRound(d.dataset.root, d.dataset.name); } else openDocs.delete(key);
  }));
  view.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
    const which = open.get(b.dataset.key) === b.dataset.which ? null : b.dataset.which;
    open.set(b.dataset.key, which);
    if (which) loadRound(b.dataset.root, b.dataset.file); else renderView();
  }));
}
const texts = new Map();
async function loadRound(root, file) {
  const key = root + "/" + file;
  if (!texts.has(key)) {
    texts.set(key, { loading: true });
    renderView();
    try {
      const res = await fetch("/api/doc?project=" + encodeURIComponent(root) + "&name=" + encodeURIComponent(file), { cache: "no-store" });
      texts.set(key, res.ok ? await res.json() : { error: "读取失败（" + res.status + "）" });
    } catch (error) {
      texts.set(key, { error: "读取失败：" + error.message });
    }
  }
  renderView();
}
const openDocs = new Set();
function lazyDoc(root, name, label) {
  const key = root + "/" + name;
  const isOpen = openDocs.has(key);
  return '<details class="note" data-root="' + esc(root) + '" data-name="' + esc(name) + '"' + (isOpen ? " open" : "") + "><summary>" + esc(label) + "</summary>" + (isOpen ? roundBody(root, { file: name }) : "") + "</details>";
}
function roundBody(root, part) {
  const t = texts.get(root + "/" + part.file);
  if (!t || t.loading) return '<div class="body note">读取中…</div>';
  if (t.error) return '<div class="body note">' + esc(t.error) + "</div>";
  return '<div class="body md">' + md(t.text) + (t.truncated ? '<div class="note">内容较长，只显示前 64KB。</div>' : "") + "</div>";
}
function tile(k, v) { return '<div class="tile"><div class="k">' + k + '</div><div class="v" title="' + esc(v) + '">' + esc(v) + "</div></div>"; }
function select(root) {
  selected = root;
  history.replaceState(null, "", "#" + encodeURIComponent(root));
  renderList(); renderView();
}
async function load() {
  try {
    const res = await fetch("/api/dashboard", { cache: "no-store" });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || res.statusText);
    data = body;
    if (!selected || !data.projects.some((p) => p.root === selected)) selected = data.projects[0]?.root ?? null;
    document.getElementById("meta").textContent = (data.version ? "Dove " + data.version + " · " : "") + data.projects.length + " 个项目 · 更新于 " + new Date(data.generatedAt).toLocaleTimeString();
    renderList(); renderView();
  } catch (error) {
    document.getElementById("meta").textContent = data
      ? "刷新失败，显示的是 " + new Date(data.generatedAt).toLocaleTimeString() + " 的数据"
      : "读取失败：" + error.message;
  }
}
document.getElementById("reload").addEventListener("click", () => { texts.clear(); load(); });
document.getElementById("picker").addEventListener("change", (e) => select(e.target.value));
document.getElementById("theme").addEventListener("click", () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
});
load();
setInterval(load, 30000);
</script>
</body>
</html>
`;
}
