import crypto from "node:crypto";
import http from "node:http";

// Local web view of registered projects; reads never update research. Binds to loopback by
// default; reach it from another machine with an SSH tunnel, or put it behind
// a public tunnel with a password so every page and API request is checked.
export const DEFAULT_DASHBOARD_PORT = 7788;
export const DEFAULT_DASHBOARD_BIND = "127.0.0.1";
const SESSION_COOKIE = "dove_dashboard";
const SESSION_MAX_AGE = 30 * 24 * 3600;
const MAX_LOGIN_BODY = 4096;

// The session value is derived from the password, so a restart keeps people
// signed in and changing the password signs everyone out.
function sessionValue(password) {
  return crypto.createHmac("sha256", password).update("dove-dashboard-session").digest("base64url");
}

function sameSecret(left, right) {
  const a = crypto.createHash("sha256").update(String(left)).digest();
  const b = crypto.createHash("sha256").update(String(right)).digest();
  return crypto.timingSafeEqual(a, b);
}

function readCookie(request, name) {
  for (const part of String(request.headers.cookie ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

function readBody(request, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("body too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function cookieAttributes(request, maxAge) {
  const secure = request.headers["x-forwarded-proto"] === "https" || Boolean(request.socket.encrypted);
  return `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

const MAX_ACTION_BODY = 1024 * 1024;
const SETTINGS_ACTIONS = new Set(["addProject", "removeProject", "syncProjects", "saveWatchConfig", "saveWatchGlobal", "saveS2Key", "runWatch", "draftWatchConfig", "startTopics", "saveTopicCriteria", "syncPaperLibrary", "saveHostSettings"]);

function sendJson(response, status, value) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
}

// Settings changes arrive as one JSON action. They need a signed-in session
// (when a password is set) and the x-dove-request header, which a cross-site
// form cannot send.
export function createDashboardServer({ collect, listRoots, readDocument, password = null, actions = null }) {
  let currentPassword = password || null;
  const session = () => (currentPassword ? sessionValue(currentPassword) : null);
  const signedIn = (request) => !currentPassword || sameSecret(readCookie(request, SESSION_COOKIE) ?? "", session());
  const knownRoot = (root) => typeof root === "string" && (listRoots?.() ?? []).includes(root);
  return http.createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (currentPassword && request.method === "POST" && url.pathname === "/login") {
      let supplied = "";
      try {
        supplied = new URLSearchParams(await readBody(request, MAX_LOGIN_BODY)).get("password") ?? "";
      } catch {
        response.writeHead(413).end();
        return;
      }
      if (sameSecret(supplied, currentPassword)) {
        response.writeHead(303, { location: "/", "set-cookie": `${SESSION_COOKIE}=${session()}; ${cookieAttributes(request, SESSION_MAX_AGE)}` }).end();
      } else {
        setTimeout(() => response.writeHead(303, { location: "/?failed=1" }).end(), 800);
      }
      return;
    }
    if (currentPassword && request.method === "POST" && url.pathname === "/logout") {
      response.writeHead(303, { location: "/", "set-cookie": `${SESSION_COOKIE}=; ${cookieAttributes(request, 0)}` }).end();
      return;
    }
    if (!signedIn(request)) {
      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        response.end(renderLoginHtml(url.searchParams.has("failed")));
      } else {
        response.writeHead(401, { "cache-control": "no-store" }).end();
      }
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/action" && actions) {
      if (request.headers["x-dove-request"] !== "1") {
        response.writeHead(403).end();
        return;
      }
      let action;
      try {
        action = JSON.parse(await readBody(request, MAX_ACTION_BODY));
      } catch {
        sendJson(response, 400, { error: "请求格式不对" });
        return;
      }
      if (action?.root !== undefined && !knownRoot(action.root) && action.type !== "addProject") {
        sendJson(response, 404, { error: "未登记的项目" });
        return;
      }
      try {
        if (action?.type === "changePassword") {
          const next = String(action.password ?? "");
          if (next.length < 8) throw new Error("新密码至少 8 位");
          await actions.changePassword(next);
          currentPassword = next;
          response.writeHead(200, { "content-type": "application/json; charset=utf-8", "set-cookie": `${SESSION_COOKIE}=${session()}; ${cookieAttributes(request, SESSION_MAX_AGE)}` });
          response.end(JSON.stringify({ ok: true }));
          return;
        }
        if (!SETTINGS_ACTIONS.has(action?.type) || typeof actions[action.type] !== "function") throw new Error("不支持的操作");
        sendJson(response, 200, { ok: true, result: await actions[action.type](action) });
      } catch (error) {
        sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
      }
      return;
    }
    if (request.method !== "GET") {
      response.writeHead(405, { allow: "GET" }).end();
      return;
    }
    if (url.pathname === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      response.end(renderDashboardHtml({ canSignOut: Boolean(currentPassword), canEdit: Boolean(actions) }));
      return;
    }
    try {
      if (url.pathname === "/api/dashboard") {
        sendJson(response, 200, collect());
        return;
      }
      if (url.pathname === "/api/settings" && actions) {
        sendJson(response, 200, await actions.getSettings({ passwordSet: Boolean(currentPassword) }));
        return;
      }
      if (url.pathname === "/api/topics" && actions) {
        sendJson(response, 200, await actions.readTopicsOverview());
        return;
      }
      if (url.pathname === "/api/trends" && actions) {
        sendJson(response, 200, await actions.readTrends());
        return;
      }
      if (url.pathname === "/api/library" && actions) {
        const root = url.searchParams.get("project");
        if (!knownRoot(root)) { response.writeHead(404).end(); return; }
        const format = url.searchParams.get("format") || "json";
        if (!["json", "md", "bib"].includes(format)) { sendJson(response, 400, { error: "不支持的文献库格式" }); return; }
        const result = await actions.readLibrary({ root, format });
        if (format === "json") {
          response.setHeader("content-disposition", 'attachment; filename="dove-library.json"');
          sendJson(response, 200, result);
        }
        else {
          response.writeHead(200, { "content-type": `${format === "bib" ? "application/x-bibtex" : "text/markdown"}; charset=utf-8`, "content-disposition": `attachment; filename="dove-library.${format}"`, "cache-control": "no-store" });
          response.end(result);
        }
        return;
      }
      if (url.pathname === "/api/watch" && actions) {
        const root = url.searchParams.get("project");
        if (!knownRoot(root)) {
          response.writeHead(404).end();
          return;
        }
        sendJson(response, 200, await actions.readWatch({ root }));
        return;
      }
    } catch (error) {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
      return;
    }
    if (url.pathname === "/api/doc") {
      const root = url.searchParams.get("project");
      const doc = knownRoot(root) ? readDocument(root, url.searchParams.get("name")) : null;
      if (!doc) {
        response.writeHead(404).end();
        return;
      }
      sendJson(response, 200, doc);
      return;
    }
    response.writeHead(404).end();
  });
}

export function startDashboardServer({ collect, listRoots, readDocument, password = null, actions = null, bind = DEFAULT_DASHBOARD_BIND, port = DEFAULT_DASHBOARD_PORT }) {
  const server = createDashboardServer({ collect, listRoots, readDocument, password, actions });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, bind, () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}

export function renderPaperCard(it, judge = null) {
  const esc = (value) => String(value ?? "").replace(/[&<>"']/gu, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const line = judge?.line || it.line;
  const details = [it.id, String(it.published || it.date || "").slice(0, 10), it.venue, (it.authors || []).join("、")].filter(Boolean);
  return '<div class="paper"><a href="' + esc(it.url) + '" target="_blank" rel="noopener">' + esc(it.title) + '</a><div class="takeaway">' + esc(line || "中文一句话待补充，暂可展开原摘要；关键词命中不是内容总结。") + '</div><div class="why">' + esc(details.join(" · ")) + (it.supplement ? " · 较早论文补充" : "") + (it.code && String(it.code).startsWith("http") ? ' · <a href="' + esc(it.code) + '" target="_blank" rel="noopener">代码/主页</a>' : "") + '</div>' + (judge ? '<div class="judge">影响判断（' + esc(judge.file || judge.round) + '）：' + esc(judge.note) + '</div>' : "") + '<details class="abs"><summary>原摘要与入选依据（不代表已读全文）</summary>' + esc(it.abstract || "未取得摘要") + '<div class="why">' + esc((it.reasons || []).join("；")) + '</div></details></div>';
}

export function renderLoginHtml(failed = false) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dove 科研面板</title>
<style>
:root { --bg: #f6f7f4; --panel: #fff; --ink: #1f2a2e; --muted: #66737a; --line: #e2e6e1; --accent: #4f7a3a; --bad: #b04a3a; }
@media (prefers-color-scheme: dark) { :root { --bg: #151a1c; --panel: #1d2427; --ink: #e5ebe8; --muted: #93a19c; --line: #2c3539; --accent: #8fbf74; --bad: #ec8f7f; } }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--ink); font: 15px/1.6 -apple-system, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif; padding: 16px; }
form { width: min(360px, 100%); background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 28px 24px; }
h1 { margin: 0 0 4px; font-size: 20px; }
p { margin: 0 0 18px; color: var(--muted); font-size: 13px; }
input { width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--ink); font: inherit; }
button { width: 100%; margin-top: 12px; padding: 10px; border: 0; border-radius: 8px; background: var(--accent); color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
.bad { color: var(--bad); font-size: 13px; margin-top: 10px; }
</style>
</head>
<body>
<form method="post" action="/login">
  <h1>🕊 Dove 科研面板</h1>
  <p>请输入访问密码</p>
  <input type="password" name="password" autocomplete="current-password" autofocus required aria-label="访问密码">
  <button type="submit">登录</button>
  ${failed ? '<div class="bad">密码不对，请重试。</div>' : ""}
</form>
</body>
</html>
`;
}

export function renderDashboardHtml({ canSignOut = false, canEdit = false } = {}) {
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
.project .foot span:first-child { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.project .foot span:last-child { white-space: nowrap; flex: none; }
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
.tabs { display: inline-flex; gap: 6px; }
.tabs button { border: 1px solid var(--line); background: none; color: var(--ink); border-radius: 6px; padding: 2px 9px; font: inherit; font-size: 12px; cursor: pointer; }
.tabs button.on { background: var(--ink); color: var(--panel); border-color: var(--ink); }
.tabs button:disabled { opacity: .45; cursor: default; }
.round .body { border-top: 1px solid var(--line); padding: 12px 16px; }
.round.current { border-color: var(--accent); }
.hero { margin: 10px 0 18px; padding: 14px 16px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); }
.hero .label { color: var(--muted); font-size: 12px; }
.hero .goal { font-size: 17px; font-weight: 600; margin: 2px 0 8px; }
.hero .facts { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; color: var(--muted); font-size: 12.5px; }
.hero .state { margin-top: 10px; font-size: 13.5px; }
.now { border: 1px solid var(--accent); border-radius: 12px; background: var(--panel); padding: 14px 16px; box-shadow: var(--shadow); }
.now .what { font-size: 15.5px; font-weight: 600; margin: 4px 0 10px; }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
.box { background: var(--bg); border-radius: 8px; padding: 9px 11px; font-size: 13.5px; }
.box .k { color: var(--muted); font-size: 12px; font-weight: 600; margin-bottom: 2px; }
.box.expect { border-left: 3px solid var(--done); }
.box.actual { border-left: 3px solid var(--accent); }
.box.missing { color: var(--muted); }
.timeline { position: relative; padding-left: 22px; }
.timeline::before { content: ""; position: absolute; left: 7px; top: 6px; bottom: 6px; width: 2px; background: var(--line); }
.tl { position: relative; margin-bottom: 12px; }
.tl .dot { position: absolute; left: -20px; top: 14px; width: 12px; height: 12px; border-radius: 50%; background: var(--panel); border: 2px solid var(--pause); }
.tl.done .dot { border-color: var(--done); background: var(--done-soft); }
.tl.running .dot { border-color: var(--accent); background: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); }
.tl .round { margin-bottom: 0; }
.tl .lines { padding: 0 14px 10px; display: grid; gap: 4px; font-size: 13.5px; }
.tl .lines .k { color: var(--muted); font-size: 12px; margin-right: 6px; font-weight: 600; }
.more { display: block; margin: 6px 0 0; }
table.wrap td { white-space: normal; min-width: 90px; max-width: 420px; }
table.wrap td:first-child { white-space: nowrap; }
dl.kv { display: grid; grid-template-columns: 7.5em minmax(0, 1fr); gap: 8px 12px; margin: 0; font-size: 13.5px; }
dl.kv dt { color: var(--muted); font-weight: 600; }
dl.kv dd { margin: 0; overflow-wrap: anywhere; }
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
nav.tabsnav { display: flex; gap: 4px; margin-left: 12px; }
nav.tabsnav button.on { background: var(--ink); color: var(--panel); border-color: var(--ink); }
.paper { padding: 10px 14px; border-bottom: 1px solid var(--line); }
.paper:last-child { border-bottom: 0; }
.paper a { color: var(--ink); font-weight: 600; text-decoration: none; }
.paper a:hover { text-decoration: underline; }
.paper .why { color: var(--muted); font-size: 12px; margin-top: 2px; }
.paper .abs { font-size: 12.5px; margin-top: 4px; color: var(--ink); opacity: .85; }
.form { display: grid; gap: 10px; }
.form label { display: grid; gap: 4px; font-size: 12.5px; color: var(--muted); }
.form input[type=text], .form input[type=password], .form input[type=number], .form textarea, .form select { font: inherit; font-size: 13.5px; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 7px 9px; width: 100%; }
.form textarea { min-height: 84px; resize: vertical; }
.form .row2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
.btn { border: 1px solid var(--line); background: var(--panel); color: var(--ink); border-radius: 8px; padding: 6px 12px; font: inherit; font-size: 13px; cursor: pointer; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn.danger { color: var(--user); }
.btns { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.reg { display: flex; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.reg:last-child { border-bottom: 0; }
.reg .p { flex: 1 1 260px; font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; overflow-wrap: anywhere; }
.group { padding: 6px 14px; font-size: 12px; font-weight: 700; background: var(--bg); border-bottom: 1px solid var(--line); }
.group.overlap { color: var(--user); } .group.baseline { color: var(--done); } .group.borrow { color: var(--accent); } .group.pending { color: var(--warn); }
.paper .judge { font-size: 12px; margin-top: 3px; }
.paper .takeaway { margin: 5px 0; font-size: 14px; }
.library { margin-top: 16px; }
.library h2 { font-size: 14px; margin: 0 0 8px; display: flex; align-items: baseline; gap: 8px; }
.library .btns { margin-bottom: 8px; }
tr.cardrow { cursor: pointer; }
tr.cardrow:hover td { background: var(--accent-soft); }
.badge-draft { display: inline-block; font-size: 11px; padding: 1px 7px; border-radius: 999px; background: var(--warn-soft); color: var(--warn); margin-left: 6px; }
#toast { position: fixed; right: 16px; bottom: 16px; background: var(--ink); color: var(--panel); padding: 8px 14px; border-radius: 8px; font-size: 13px; opacity: 0; transition: opacity .2s; pointer-events: none; max-width: calc(100vw - 32px); }
#toast.show { opacity: 1; }
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
  ${canEdit ? '<nav class="tabsnav"><button id="navProjects" class="on">项目</button><button id="navTrends">动态</button><button id="navTopics">选题</button><button id="navSettings">设置</button></nav>' : ""}
  <span class="meta" id="meta">加载中…</span>
  <button id="theme" title="切换明暗">明/暗</button>
  <button id="reload">刷新</button>
  ${canSignOut ? '<form method="post" action="/logout" style="margin:0"><button type="submit">退出</button></form>' : ""}
</header>
<select class="mobile" id="picker" aria-label="选择项目"></select>
<div class="layout">
  <aside id="list"></aside>
  <main id="view"><div class="empty">加载中…</div></main>
</div>
<div id="toast"></div>
<script>
const CAN_EDIT = ${canEdit ? "true" : "false"};
const MODES = ["settings", "trends", "topics"];
let mode = CAN_EDIT && MODES.includes(location.hash.slice(1)) ? location.hash.slice(1) : "projects";
let trends = null;
let topics = null;
let topicRoot = null;
let settings = null;
const watchCache = new Map();
const STATUS = { ongoing: ["ongoing", "进行中"], "进行中": ["ongoing", "进行中"], paused: ["paused", "已暂停"], "暂停": ["paused", "已暂停"], completed: ["completed", "已完成"], "完成": ["completed", "已完成"] };
const AUTHOR = { mentor: "导师", user: "用户", external: "外部", other: "其他" };
let data = null;
let selected = ["#settings", "#trends", "#topics"].includes(location.hash) ? null : decodeURIComponent(location.hash.slice(1)) || null;
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
      '<div class="foot"><span>' + esc(p.currentSummary ? "本轮：" + p.currentSummary : (p.currentRound ? "本轮：" + roundNo(p.currentRound) : "—")) + "</span><span>" + ago(p.lastActivity) + "</span></div>" +
    "</button>").join("") || '<div class="empty">没有已登记且有研究记录的项目。</div>';
  list.querySelectorAll(".project").forEach((el) => el.addEventListener("click", () => select(el.dataset.root)));
  picker.innerHTML = data.projects.map((p) => '<option value="' + esc(p.root) + '"' + (p.root === selected ? " selected" : "") + ">" + esc(p.name) + "</option>").join("");
}
const COLUMNS = { "Date": "日期", "Version/round": "版本/轮次", "Protocol/split": "协议与数据", "Measurements": "测量结果", "Unseen data/train-test gap": "未见数据与泛化差距", "Conclusion": "结论", "Artifacts": "产物" };
const CARD = { "Current round": "当前轮次", "Round status": "轮次状态", "Mainline": "主线", "Core capability": "核心能力", "Target tier": "目标档次", "Target tier (conference/journal level)": "目标档次", "Deployment inputs/outputs": "输入与输出", "Completion": "完成标准", "User restrictions": "用户限制", "Recent corrections": "最近纠正", "Research state": "研究现状" };
function roundNo(file) { const m = String(file || "").match(/(\\d+)[-_]brief/); return m ? "第 " + m[1] + " 轮" : String(file || ""); }
function statusOf(p, r, newestDone) {
  const current = p.currentRound && p.currentRound.includes(r.label);
  if (r.result) return ["done", "有结果"];
  if (current || r.number > newestDone) return ["running", "进行中"];
  return ["idle", "未出结果"];
}
function line(k, v, cls) { return v ? '<div' + (cls ? ' class="' + cls + '"' : "") + '><span class="k">' + k + "</span>" + esc(v) + "</div>" : ""; }
function roundTabs(p, r) {
  const key = p.root + "#" + r.number;
  const which = open.get(key);
  return '<span class="tabs"><button data-key="' + esc(key) + '" data-root="' + esc(p.root) + '" data-file="' + esc(r.brief ? r.brief.file : "") + '" data-which="brief"' + (r.brief ? "" : " disabled") + (which === "brief" ? ' class="on"' : "") + ">说明全文</button>" +
    '<button data-key="' + esc(key) + '" data-root="' + esc(p.root) + '" data-file="' + esc(r.result ? r.result.file : "") + '" data-which="result"' + (r.result ? "" : " disabled") + (which === "result" ? ' class="on"' : "") + ">结果全文</button></span>";
}
function roundBodyOpen(p, r) { const which = open.get(p.root + "#" + r.number); return which && r[which] ? roundBody(p.root, r[which]) : ""; }
function nowSection(p, running, latest) {
  let html = '<section><h2>现在在做什么 <span class="sub">取自当前轮次的说明和结果</span></h2>';
  const list = running.length ? running : (latest ? [latest] : []);
  if (!list.length) return html + '<div class="card note">还没有轮次记录。</div></section>';
  for (const r of list) {
    const b = r.brief || {}, res = r.result || {};
    const isRunning = !r.result;
    html += '<div class="now" style="margin-bottom:10px"><div class="facts" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      '<strong>第 ' + esc(r.label) + ' 轮</strong>' + authorChip(r.author) + '<span class="chip ' + (isRunning ? "ongoing" : "completed") + '">' + (isRunning ? "进行中" : "最近一轮已有结果") + '</span><span class="note" style="margin:0">' + ago((r.result || r.brief || {}).mtime) + "</span>" + roundTabs(p, r) + "</div>" +
      '<div class="what">' + esc(b.summary || r.title || "这一轮的说明没有写一句话目标。") + "</div>" +
      '<div class="grid2">' +
      '<div class="box expect' + (b.expected ? "" : " missing") + '"><div class="k">预期结果</div>' + esc(b.expected || "说明里没有写预期结果。") + "</div>" +
      '<div class="box actual' + (res.summary || res.actual ? "" : " missing") + '"><div class="k">' + (isRunning ? "实际结果" : "实际结果与预期对照") + "</div>" + esc(isRunning ? "还在进行，结果出来后显示在这里。" : (res.actual || res.summary || "结果里没有写预期与实际的对照。")) + "</div>" +
      "</div>" + roundBodyOpen(p, r) + "</div>";
  }
  return html + "</section>";
}
function trajectorySection(p, newestDone) {
  let html = '<section><h2>科研轨迹 <span class="sub">每轮的目标、预期和实际结果 · 新的在上</span></h2>';
  if (!p.rounds.length) return html + '<div class="card note">还没有轮次记录。</div></section>';
  const showAll = open.get(p.root + "#trajectory") === "all";
  const rounds = showAll ? p.rounds : p.rounds.slice(0, 8);
  html += '<div class="timeline">' + rounds.map((r) => {
    const [cls, label] = statusOf(p, r, newestDone);
    const b = r.brief || {}, res = r.result || {};
    return '<div class="tl ' + cls + '"><span class="dot"></span><div class="round' + (cls === "running" ? " current" : "") + '"><div class="head">' +
      '<span class="no">第 ' + esc(r.label) + " 轮</span>" + authorChip(r.author) + '<span class="chip ' + (cls === "done" ? "completed" : cls === "running" ? "ongoing" : "none") + '">' + label + "</span>" +
      '<span class="time">' + ago((r.result || r.brief || {}).mtime) + "</span>" + roundTabs(p, r) + "</div>" +
      '<div class="lines">' + line("目标", b.summary || r.title) + line("预期", b.expected) + line("结果", res.actual || res.summary) + "</div>" +
      roundBodyOpen(p, r) + "</div></div>";
  }).join("") + "</div>";
  if (p.rounds.length > 8) html += '<button class="btn more" data-toggle="' + esc(p.root + "#trajectory") + '">' + (showAll ? "只看最近 8 轮" : "展开全部 " + p.rounds.length + " 轮") + "</button>";
  return html + "</section>";
}
function evaluationSection(p) {
  let html = '<section><h2>评测结果 <span class="sub">EVAL.md · 每个方法版本一行</span></h2>';
  if (!p.evaluation) return html + '<div class="card note">还没有评测表。主线确认后，执行者建立能回答研究问题的评测。</div></section>';
  if (!p.evaluation.tables.length) return html + '<div class="card md">' + md(p.evaluation.text) + "</div></section>";
  const showAll = open.get(p.root + "#eval") === "all";
  for (const t of p.evaluation.tables) {
    const assessment = t.header.some((c) => /维度|dimension/i.test(c));
    if (assessment) continue;
    const rows = showAll ? t.rows : t.rows.slice(-5);
    html += '<div class="tablewrap">' + tableHtml([t.header.map((c) => COLUMNS[c] || c), ...rows], true).replace("<table>", '<table class="wrap">') + "</div>";
    if (t.rows.length > 5) html += '<button class="btn more" data-toggle="' + esc(p.root + "#eval") + '">' + (showAll ? "只看最近 5 行" : "展开全部 " + t.rows.length + " 行") + "</button>";
  }
  const judged = p.evaluation.tables.filter((t) => t.header.some((c) => /维度|dimension/i.test(c)));
  if (judged.length) html += '<details class="card" style="margin-top:10px"><summary>导师对研究质量的当前判断（八个维度）</summary>' + judged.map((t) => '<div class="tablewrap" style="margin-top:8px">' + tableHtml([t.header, ...t.rows], false).replace("<table>", '<table class="wrap">') + "</div>").join("") + "</details>";
  html += lazyDoc(p.root, "EVAL.md", "查看 EVAL.md 原文");
  return html + "</section>";
}
function identitySection(p) {
  let html = '<section><details class="card"' + (open.get(p.root + "#card") === "open" ? " open" : "") + ' data-card="' + esc(p.root) + '"><summary>项目档案（身份卡 IDENTITY.md）</summary>';
  if (!p.identity) return html + '<div class="note">还没有身份卡。</div></details></section>';
  const rows = [];
  let rest = [];
  for (const raw of p.identity.text.split(/\\r?\\n/)) {
    const m = raw.match(/^\\s*(?:[-*]\\s*)?\\**([^:：*]{1,40}?)\\**\\s*[:：]\\s*(.+)$/);
    if (m && CARD[m[1].trim()]) rows.push([CARD[m[1].trim()], m[2].trim()]);
    else if (raw.trim() && !/^#/.test(raw)) rest.push(raw);
  }
  html += '<dl class="kv" style="margin-top:10px">' + rows.map(([k, v]) => "<dt>" + esc(k) + "</dt><dd>" + inline(v) + "</dd>").join("") + "</dl>";
  if (rest.length) html += '<div class="md">' + md(rest.join("\\n")) + "</div>";
  if (p.identity.text.length > 4096) html += '<div class="note">身份卡超过 4KB，宿主只会看到开头部分。</div>';
  return html + "</details></section>";
}
function intentSection(p) {
  const intent = p.longTermIntent;
  if (!intent) return '<div class="note">尚未读到长期意图对照；下次导师调用时核对笔记并补充。</div>';
  return '<details class="card" data-intent="' + esc(p.root) + '"' + (open.get(p.root + "#intent") === "open" ? " open" : "") + '><summary>长期意图 · ' + esc(intent.date || "未注明日期") + (intent.due ? " · 对照到期" : "") + '</summary><div class="md">' + md(intent.text) + '</div></details>';
}
function renderView() {
  const view = document.getElementById("view");
  const p = data.projects.find((item) => item.root === selected);
  if (!p) { view.innerHTML = '<div class="empty">从左侧选择一个项目。</div>'; return; }
  const newestDone = Math.max(0, ...p.rounds.filter((r) => r.result).map((r) => r.number));
  const running = p.rounds.filter((r) => statusOf(p, r, newestDone)[0] === "running");
  let html = '<h1 class="title">' + esc(p.name) + '</h1><div class="path">' + esc(p.root) + "</div>";
  html += '<div class="hero"><div class="label">主线</div><div class="goal">' + esc(p.mainline || "身份卡里还没有主线。") + '</div>' +
    (p.coreCapability ? '<div class="state"><span class="note" style="margin-right:6px">核心能力</span>' + esc(p.coreCapability) + "</div>" : '<div class="state"><span class="note" style="margin-right:6px">核心能力</span>身份卡里还没有写。</div>') +
    '<div class="facts">' + statusChip(p.roundStatus) + (p.targetTier ? "<span>目标档次：" + esc(p.targetTier) + "</span>" : "") + "<span>共 " + p.rounds.length + " 轮</span><span>最近更新 " + ago(p.lastActivity) + "</span></div>" +
    (p.researchState ? '<div class="state"><span class="note" style="margin-right:6px">研究现状</span>' + esc(p.researchState) + "</div>" : "") + "</div>";
  html += '<section><h2>长期意图 <span class="sub">导师最近一次对照</span></h2>' + intentSection(p) + "</section>";
  html += nowSection(p, running, p.rounds[0]);
  html += trajectorySection(p, newestDone);
  html += evaluationSection(p);
  if (CAN_EDIT) html += papersSection(p.root);
  html += identitySection(p);
  if (p.doctor) html += "<section>" + lazyDoc(p.root, "DOCTOR.md", "Dove 集成问题记录（DOCTOR.md）") + "</section>";
  view.innerHTML = html;
  view.querySelectorAll(".librarySync").forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true;
    try { await act("syncPaperLibrary", { root: b.dataset.root }); watchCache.delete(b.dataset.root); await loadWatch(b.dataset.root); toast("已积累已有影响判断，未运行检索"); }
    catch (error) { toast(error.message); b.disabled = false; }
  }));
  view.querySelectorAll("details[data-name]").forEach((d) => d.addEventListener("toggle", () => {
    const key = d.dataset.root + "/" + d.dataset.name;
    if (d.open) { openDocs.add(key); loadRound(d.dataset.root, d.dataset.name); } else openDocs.delete(key);
  }));
  view.querySelectorAll("details[data-card]").forEach((d) => d.addEventListener("toggle", () => open.set(d.dataset.card + "#card", d.open ? "open" : null)));
  view.querySelectorAll("details[data-intent]").forEach((d) => d.addEventListener("toggle", () => open.set(d.dataset.intent + "#intent", d.open ? "open" : null)));
  view.querySelectorAll("button[data-toggle]").forEach((b) => b.addEventListener("click", () => { open.set(b.dataset.toggle, open.get(b.dataset.toggle) === "all" ? null : "all"); renderView(); }));
  view.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
    const which = open.get(b.dataset.key) === b.dataset.which ? null : b.dataset.which;
    open.set(b.dataset.key, which);
    if (which) loadRound(b.dataset.root, b.dataset.file); else renderView();
  }));
}
const texts = new Map();
function rerender() { if (mode === "topics") renderTopics(); else if (mode === "projects") renderView(); }
async function loadRound(root, file) {
  const key = root + "/" + file;
  if (!texts.has(key)) {
    texts.set(key, { loading: true });
    rerender();
    try {
      const res = await fetch("/api/doc?project=" + encodeURIComponent(root) + "&name=" + encodeURIComponent(file), { cache: "no-store" });
      texts.set(key, res.ok ? await res.json() : { error: "读取失败（" + res.status + "）" });
    } catch (error) {
      texts.set(key, { error: "读取失败：" + error.message });
    }
  }
  rerender();
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
const GROUPS = [["overlap", "撞题：贡献可能被覆盖"], ["baseline", "新基线：该进评测对照"], ["borrow", "可借用：方法或数据"], ["pending", "待导师判断"]];
const paperHtml = ${renderPaperCard.toString()};
function librarySection(root, groups) {
  const endpoint = '/api/library?project=' + encodeURIComponent(root);
  let html = '<div class="library"><h2>项目文献库 <span class="sub">按方向积累已判断的有用论文</span></h2><div class="btns"><button class="btn librarySync" data-root="' + esc(root) + '">积累已有影响判断</button>' + [["json", "JSON"], ["md", "Markdown"], ["bib", "BibTeX"]].map(([format, label]) => '<a class="btn" href="' + esc(endpoint + '&format=' + format) + '">' + label + '</a>').join("") + '</div>';
  if (!groups.length) return html + '<div class="note">还没有已积累的论文。主会话保存带方向和中文一句话的影响判断后，点上方积累，或由下一次正常追踪收录。</div></div>';
  for (const group of groups) html += '<details class="card"><summary>' + esc(group.direction) + ' · ' + group.papers.length + ' 篇</summary>' + group.papers.map((paper) => paperHtml(paper)).join("") + '</details>';
  return html + '</div>';
}
function papersSection(root) {
  let html = '<section><h2>新论文 <span class="sub">论文追踪 · 按导师的影响判断分组</span></h2>';
  const w = watchCache.get(root);
  if (!w || w.loading) { if (!w) loadWatch(root); return html + '<div class="card note">读取中…</div></section>'; }
  if (w.error) return html + '<div class="card note">' + esc(w.error) + "</div></section>";
  html += librarySection(root, w.library || []);
  const c = w.config;
  if (w.guidance) html += '<div class="card note">' + esc(w.guidance) + "</div>";
  if (w.scan) html += lazyScan(root, w.scan);
  if (w.scanDue) html += '<div class="note">领域扫描待更新：下一次导师调用顺带完成，由主会话保存到 watch/scan-YYYY-MM-DD.md，不必等下一轮。</div>';
  const notes = [...new Set([...(w.state?.notes || []), ...(w.digests || []).flatMap((d) => d.notes || [])])];
  if (notes.length) html += '<details class="note"><summary>检索说明（' + notes.length + ' 条）</summary>' + notes.map((note) => '<div>' + esc(note) + '</div>').join("") + '</details>';
  if (!c.keywords.length && !c.authors.length && !c.seedPapers.length) return html + '<div class="card note">还没有追踪内容。下次运行会根据项目资料自动生成初稿，也可以到「设置」里填写。</div></section>';
  const seenIds = new Set();
  const items = [];
  for (const it of [...(w.digests || []).flatMap((d) => d.items), ...(w.pending || [])]) if (!seenIds.has(it.id)) { seenIds.add(it.id); items.push(it); }
  const incomplete = ["failed", "partial"].includes(w.state?.status) || (w.digests || []).some((d) => ["failed", "partial"].includes(d.status) || (!d.status && d.notes?.length));
  if (incomplete) html += '<div class="card note">部分来源检索失败或未完成，不能据此判断没有新的相关论文。下方保留已取得的结果。</div>';
  if (!items.length) return html + '<div class="card note">' + (incomplete ? "暂无可展示的结果，请查看检索说明。" : w.digests?.length ? "最近的检索没有发现新的相关论文。" : "还没运行过。可以在设置页点「立即运行」。") + "</div></section>";
  const impacts = w.impacts || {};
  html += '<div class="card" style="padding:0"><div class="paper why">最近检索与此前待判断论文 · ' + items.length + " 篇</div>";
  for (const [key, label] of GROUPS) {
    const group = items.filter((it) => (impacts[it.id]?.impact || "pending") === key);
    if (group.length) html += '<div class="group ' + key + '">' + label + " · " + group.length + "</div>" + group.map((it) => paperHtml(it, impacts[it.id])).join("");
  }
  const ignored = items.filter((it) => impacts[it.id]?.impact === "irrelevant").length;
  if (ignored) html += '<div class="paper why">导师判为无关：' + ignored + " 篇（已隐藏）</div>";
  html += "</div>";
  return html + "</section>";
}
function lazyScan(root, scan) {
  return '<details class="note" style="margin-top:8px"><summary>导师最近一次领域扫描（' + esc(scan.date) + '）</summary><div class="card md">' + md(scan.text) + "</div></details>";
}
function renderTrends() {
  const view = document.getElementById("view");
  if (!trends) { view.innerHTML = '<div class="empty">加载中…</div>'; loadTrends(); return; }
  if (trends.error) { view.innerHTML = '<div class="empty">' + esc(trends.error) + "</div>"; return; }
  let html = '<h1 class="title">本周领域动态</h1><div class="path">自 ' + esc(trends.since) + " 起 · 所有项目的追踪结果汇总</div>";
  html += '<section style="margin-top:18px"><h2>各项目最相关的新论文 <span class="sub">导师判过的排在前面</span></h2><div class="card" style="padding:0">';
  html += trends.top.map((it) => '<div class="group">' + esc(it.projects.join("、")) + (it.impacts.length ? " · " + esc(it.impacts.map((x) => x.project + "：" + x.label).join("；")) : "") + '</div>' + paperHtml(it, it.impacts.find((impact) => impact.line))).join("") || '<div class="paper note">这一周还没有追踪结果。</div>';
  html += "</div></section>";
  html += '<section><h2>社区热点里和你方向相关的 <span class="sub">Hugging Face 每日论文榜，通过项目相关性筛选</span></h2><div class="card" style="padding:0">';
  html += trends.hot.map((it) => paperHtml(it)).join("") || '<div class="paper note">暂时没有。</div>';
  html += "</div></section>";
  html += '<section><h2>导师领域扫描 <span class="sub">每周一次，在导师环节用网页和论文检索完成</span></h2>';
  html += trends.scans.map((x) => '<details class="note"><summary>' + esc(x.project) + " · " + esc(x.date || "尚未扫描") + (x.due ? " · 下次导师调用待更新" : "") + '</summary><div class="card md">' + (x.text ? md(x.text) : "不依赖轮次；主会话保存导师返回的领域扫描到 watch/scan-YYYY-MM-DD.md。") + "</div></details>").join("") || '<div class="card note">还没有扫描记录。</div>';
  html += "</section>";
  view.innerHTML = html;
}
const TOPIC_STATUS = { 推荐: "completed", 选定: "completed", 维持: "ongoing", 候选: "paused", 限定: "none", 暂缓: "none", 撤回: "other" };
function renderTopics() {
  const view = document.getElementById("view");
  if (!topics) { view.innerHTML = '<div class="empty">加载中…</div>'; loadTopics(); return; }
  if (topics.error) { view.innerHTML = '<div class="empty">' + esc(topics.error) + "</div>"; return; }
  const c = topics.criteria;
  let html = '<h1 class="title">选题</h1><div class="path">依据：' + (c.present ? esc(c.title || "选题标准") + (c.version ? "（第 " + esc(c.version) + " 版）" : "") : "还没有选题标准，先到「设置」里粘贴") + "</div>";
  const started = topics.projects.filter((x) => x.started);
  if (!topicRoot || !started.some((x) => x.root === topicRoot)) topicRoot = started[0]?.root ?? null;
  html += '<section style="margin-top:18px"><h2>项目</h2><div class="card btns">' + topics.projects.map((x) => x.started
    ? '<button class="btn' + (x.root === topicRoot ? " primary" : "") + ' tPick" data-root="' + esc(x.root) + '">' + esc(x.name) + " · " + (x.cards || []).length + " 个候选</button>"
    : '<button class="btn tStart" data-root="' + esc(x.root) + '"' + (c.present ? "" : " disabled") + ">在 " + esc(x.name) + " 开始选题</button>").join("") + "</div></section>";
  const t = started.find((x) => x.root === topicRoot);
  if (t) {
    if (t.criteria && c.present && t.criteria.version !== c.version) html += '<div class="card note" style="margin-bottom:12px">这个项目用的是第 ' + esc(t.criteria.version || "?") + " 版标准，当前标准是第 " + esc(c.version || "?") + ' 版。<button class="btn tStart" data-root="' + esc(t.root) + '">换成当前版本</button></div>';
    html += '<section><h2>候选方向 <span class="sub">缺口 → 来源机制 → 对应关系；评审定位决定性瓶颈与共因</span></h2>';
    if (!t.cards.length) html += '<div class="card note">还没有候选卡。正常选题时先读标准、找有正文依据的缺口，再跨领域找机制；不替已有项目重开选题。</div>';
    else html += '<div class="tablewrap"><table><thead><tr><th>候选</th><th>定位</th><th>阶段</th><th>状态</th><th>评审</th><th>想法与依据</th></tr></thead><tbody>' + t.cards.map((k) =>
      '<tr class="cardrow" data-file="' + esc(k.file) + '"><td>' + esc(k.title || k.name) + "</td><td>" + esc(k.position || "—") + "</td><td>" + esc(k.stage || "—") + '</td><td><span class="chip ' + (TOPIC_STATUS[(k.status || "").slice(0, 2)] || "other") + '">' + esc(k.status || "未标") + '</span></td><td style="white-space:normal;min-width:160px">' + esc(k.verdict || "待判断") + (k.focus ? '<div class="note">修改焦点：' + esc(k.focus) + '</div>' : "") + (k.reviewEvidence ? '<div class="note">依据：' + esc(k.reviewEvidence) + '</div>' : "") + (k.objection ? '<div class="note">最强反对：' + esc(k.objection) + '</div>' : "") + '</td><td style="white-space:normal;min-width:280px">' + esc(k.summary || "") + [["缺口", k.gap], ["来源机制", k.source], ["对应关系", k.mapping], ["成立前提", k.assumptions], ["近邻差别", k.novelty], ["最大风险", k.risk], ["改进自", k.improves]].filter(([, value]) => value).map(([label, value]) => '<div class="note">' + label + '：' + esc(value) + '</div>').join("") + "</td></tr>" +
      (openDocs.has(t.root + "/" + k.file) ? '<tr><td colspan="6" style="white-space:normal">' + roundBody(t.root, { file: k.file }) + "</td></tr>" : "")).join("") + "</tbody></table></div>";
    html += "</section>";
    if (t.documents.length) html += '<section><h2>阶段材料</h2>' + t.documents.map((d) => lazyDoc(t.root, d, d.replace("topics/", ""))).join("") + "</section>";
  }
  view.innerHTML = html;
  view.querySelectorAll(".tPick").forEach((b) => b.addEventListener("click", () => { topicRoot = b.dataset.root; renderTopics(); }));
  view.querySelectorAll(".tStart").forEach((b) => b.addEventListener("click", async () => {
    b.disabled = true;
    try { await act("startTopics", { root: b.dataset.root }); topicRoot = b.dataset.root; toast("已建立选题目录"); topics = null; renderTopics(); }
    catch (error) { toast(error.message); b.disabled = false; }
  }));
  view.querySelectorAll("tr.cardrow").forEach((r) => r.addEventListener("click", () => {
    const key = topicRoot + "/" + r.dataset.file;
    if (openDocs.has(key)) { openDocs.delete(key); renderTopics(); } else { openDocs.add(key); loadRound(topicRoot, r.dataset.file); }
  }));
  view.querySelectorAll("details[data-name]").forEach((d) => d.addEventListener("toggle", () => {
    const key = d.dataset.root + "/" + d.dataset.name;
    if (d.open) { openDocs.add(key); loadRound(d.dataset.root, d.dataset.name); } else openDocs.delete(key);
  }));
}
async function loadTopics() {
  try {
    const res = await fetch("/api/topics", { cache: "no-store" });
    if (res.status === 401) { location.reload(); return; }
    topics = res.ok ? await res.json() : { error: "读取失败（" + res.status + "）" };
  } catch (error) {
    topics = { error: "读取失败：" + error.message };
  }
  if (mode === "topics") renderTopics();
}
async function loadTrends() {
  try {
    const res = await fetch("/api/trends", { cache: "no-store" });
    if (res.status === 401) { location.reload(); return; }
    trends = res.ok ? await res.json() : { error: "读取失败（" + res.status + "）" };
  } catch (error) {
    trends = { error: "读取失败：" + error.message };
  }
  if (mode === "trends") renderTrends();
}
async function loadWatch(root) {
  watchCache.set(root, { loading: true });
  try {
    const res = await fetch("/api/watch?project=" + encodeURIComponent(root), { cache: "no-store" });
    watchCache.set(root, res.ok ? await res.json() : { error: "读取失败（" + res.status + "）" });
  } catch (error) {
    watchCache.set(root, { error: "读取失败：" + error.message });
  }
  if (mode === "projects" && selected === root) renderView();
}
function toast(text) {
  const el = document.getElementById("toast");
  el.textContent = text; el.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 3200);
}
async function act(type, payload) {
  const res = await fetch("/api/action", { method: "POST", headers: { "content-type": "application/json", "x-dove-request": "1" }, body: JSON.stringify({ type, ...payload }) });
  if (res.status === 401) { location.reload(); throw new Error("请重新登录"); }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "操作失败（" + res.status + "）");
  return body.result;
}
async function loadSettings() {
  try {
    const res = await fetch("/api/settings", { cache: "no-store" });
    if (res.status === 401) { location.reload(); return; }
    settings = await res.json();
  } catch (error) {
    settings = { error: error.message };
  }
  if (mode === "settings") {
    renderSettings();
    clearTimeout(loadSettings.timer);
    if (settings.watchRunning) loadSettings.timer = setTimeout(loadSettings, 4000);
  }
}
async function startWatchFromPanel(root) {
  const result = await act("runWatch", root ? { root } : {});
  toast(result.started ? "已开始运行，完成后自动刷新" : result.reason);
  watchCache.clear();
  await loadSettings();
  if (result.guidance?.length) {
    const note = document.createElement("div");
    note.className = "card note";
    note.textContent = result.guidance.map((item) => item.root.split("/").pop() + "：" + item.message).join("；");
    document.getElementById("view").prepend(note);
  }
}
const lines = (v) => (v || []).join("\\n");
function renderSettings() {
  const view = document.getElementById("view");
  if (!settings) { view.innerHTML = '<div class="empty">加载中…</div>'; loadSettings(); return; }
  if (settings.error) { view.innerHTML = '<div class="empty">' + esc(settings.error) + "</div>"; return; }
  const g = settings.watchGlobal, st = settings.watchState || {};
  let html = '<h1 class="title">设置</h1><div class="path">保存后立即生效，研究记录本身不会被这里修改。</div>';
  html += '<section style="margin-top:18px"><h2>论文追踪 <span class="sub">每天自动抓 arXiv 新论文，用 Hugging Face 热门榜和 Semantic Scholar 排序</span></h2><div class="card form">' +
    '<div class="row2"><label>每天几点运行（服务器时间）<select id="wHour">' + Array.from({ length: 24 }, (_, h) => '<option value="' + h + '"' + (h === g.dailyHour ? " selected" : "") + ">" + h + ":00</option>").join("") + "</select></label>" +
    '<label>每次回看几天<input type="number" id="wDays" min="1" max="14" value="' + esc(g.lookbackDays) + '"></label>' +
    '<label>每个项目最多保留几篇<input type="number" id="wMax" min="5" max="200" value="' + esc(g.maxPerDigest) + '"></label>' +
    '<label>网络代理（可空）<input type="text" id="wProxy" placeholder="服务器连不上 Hugging Face 时填，例如 http://127.0.0.1:7890" value="' + esc(g.proxy) + '"></label></div>' +
    '<label><span><input type="checkbox" id="wSupplement"' + (g.supplementOlder ? ' checked' : '') + '> 没有新论文时补少量未推过的重要旧文（默认关闭，最多 5 篇，不降低相关性）</span></label>' +
    '<div class="btns"><button class="btn primary" id="wSave">保存</button><button class="btn" id="wRunAll">立即运行全部项目</button><span class="note">' +
    esc(settings.watchRunning ? "正在运行…" : (st.lastAttempt || st.lastRun) ? "上次尝试：" + new Date(st.lastAttempt || st.lastRun).toLocaleString() + " · " + (st.results || []).map((r) => r.root.split("/").pop() + " " + ({ done: (r.found ?? 0) + " 篇", partial: "检索未完成，已找到 " + (r.found ?? 0) + " 篇", unconfigured: "未设关键词", disabled: "已关闭", failed: "检索失败" }[r.status] || r.status)).join("，") : "还没运行过") + "</span></div>" +
    (settings.watchError ? '<div class="note">运行失败：' + esc(settings.watchError) + '</div>' : "") +
    [...(st.hfErrors || []), ...(st.results || []).flatMap((r) => r.notes || (r.error ? [r.error] : []))].map((note) => '<div class="note">' + esc(note) + '</div>').join("") +
    '<div class="btns" style="margin-top:6px"><label style="flex:1 1 260px">Semantic Scholar API key（可选，' + (settings.s2KeySet ? "已设置" : "未设置") + '；没有也能运行）<input type="password" id="s2Key" placeholder="' + (settings.s2KeySet ? "输入新 key 可替换" : "粘贴 key") + '" autocomplete="off"></label><button class="btn" id="s2Save">保存 key</button>' + (settings.s2KeySet ? '<button class="btn danger" id="s2Clear">清除 key</button>' : "") + "</div></div></section>";
  const tc = settings.topicCriteria || {};
  html += '<section><h2>选题标准 <span class="sub">选题功能以这份文档为准；开始选题时复制进项目</span></h2><div class="card form"><div class="note">' + (tc.present ? "当前：" + esc(tc.title || "") + (tc.version ? "（第 " + esc(tc.version) + " 版）" : "") + " · " + Math.round(tc.bytes / 1024) + " KB · 更新于 " + new Date(tc.updatedAt).toLocaleString() + (tc.projectSection ? "。其中「" + esc(tc.projectSection) + "」是某个项目自己的设置，开始选题时不会带进项目；每个项目的设置写在它自己的 topics/PROJECT.md" : "") : "还没有设置") + '</div><label>粘贴新版本的完整内容来替换<textarea id="tcText" style="min-height:120px" placeholder="# 论文选题要求、论证原则与交付规范 …"></textarea></label><div class="btns"><button class="btn primary" id="tcSave">保存选题标准</button></div></div></section>';
  html += '<section><h2>各项目追踪内容 <span class="sub">关键词一行一个，命中标题权重高；关注作者命中会加分</span></h2>';
  if (!settings.projects.length) html += '<div class="card note">还没有带研究记录的已登记项目。</div>';
  html += settings.projects.map((p, i) => '<div class="card form" style="margin-bottom:10px" data-i="' + i + '"><div class="btns"><strong style="flex:1">' + esc(p.name) + '</strong><span class="btns" style="color:var(--ink);font-size:13px"><input type="checkbox" class="wEnabled" id="wEn' + i + '"' + (p.watch.enabled ? " checked" : "") + '><label for="wEn' + i + '" style="display:inline;color:var(--ink)">启用追踪</label></span></div>' +
    '<div class="row2"><label>关键词<textarea class="wKeywords" placeholder="例如：sewing pattern">' + esc(lines(p.watch.keywords)) + "</textarea></label>" +
    '<label>关注作者<textarea class="wAuthors" placeholder="例如：Maria Korosteleva（可空）">' + esc(lines(p.watch.authors)) + "</textarea></label></div>" +
    '<div class="row2"><label>关注会议（一行一个，命中加分）<textarea class="wVenues" placeholder="例如：CVPR">' + esc(lines(p.watch.venues)) + "</textarea></label>" +
    '<label>关注机构（一行一个，经 OpenAlex 匹配）<textarea class="wInsts" placeholder="例如：ETH Zurich">' + esc(lines(p.watch.institutions)) + "</textarea></label></div>" +
    '<label>近邻论文（arXiv 编号或链接，一行一个；追踪新引用它们的论文）<textarea class="wSeeds" placeholder="例如：2306.03642">' + esc(lines(p.watch.seedPapers)) + "</textarea></label>" +
    '<label>arXiv 分类（逗号分隔）<input type="text" class="wCats" value="' + esc(p.watch.categories.join(", ")) + '"></label>' +
    '<div class="btns"><button class="btn primary wSaveP" data-root="' + esc(p.root) + '">保存</button><button class="btn wRunP" data-root="' + esc(p.root) + '">只运行这个项目</button><button class="btn wDraftP" data-root="' + esc(p.root) + '">根据项目资料生成初稿</button>' + (p.watch.source === "draft" ? '<span class="badge-draft">当前是自动初稿</span>' : "") + "</div>" + (p.guidance ? '<div class="note">' + esc(p.guidance) + '</div>' : "") + "</div>").join("");
  html += "</section>";
  html += '<section><h2>更新后的宿主迁移</h2><div class="card form"><label><span><input type="checkbox" id="hostMigration"' + (settings.hostSettings?.hostMigration ? ' checked' : '') + '> 连带更新时登记迁移待办（默认关闭）</span></label><div class="note">钩子只送达待办；项目宿主在当前工作告一段落后整理已有记录，不暂停或重启训练、评测，不改研究结论和用户原话。完成后同一版本不重复。</div><div class="btns"><button class="btn primary" id="hostSave">保存迁移设置</button></div></div></section>';
  html += '<section><h2>项目登记 <span class="sub">登记的项目会随 Dove 升级自动更新，并显示在面板里</span></h2><div class="card">' +
    settings.registered.map((r) => '<div class="reg"><span class="p">' + esc(r.root) + "</span>" + (r.exists ? "" : '<span class="chip none">目录不存在</span>') + '<button class="btn danger regRemove" data-root="' + esc(r.root) + '">移出登记</button></div>').join("") +
    '<div class="reg"><input type="text" id="regPath" placeholder="已安装 Dove 的项目绝对路径" style="flex:1 1 260px;font:inherit;padding:6px 9px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink)"><button class="btn" id="regAdd">登记</button><button class="btn" id="regSync">把所有项目更新到当前版本</button></div></div></section>';
  if (settings.canChangePassword) html += '<section><h2>面板密码</h2><div class="card form"><div class="row2"><label>新密码（至少 8 位）<input type="password" id="pw1" autocomplete="new-password"></label><label>再输一次<input type="password" id="pw2" autocomplete="new-password"></label></div><div class="btns"><button class="btn primary" id="pwSave">修改密码</button><span class="note">修改后其他设备需要重新登录。</span></div></div></section>';
  view.innerHTML = html;
  const run = (fn) => async (event) => { const b = event.currentTarget; b.disabled = true; try { await fn(b); } catch (error) { toast(error.message); } finally { b.disabled = false; } };
  const byId = (id) => document.getElementById(id);
  byId("wSave").addEventListener("click", run(async () => { await act("saveWatchGlobal", { settings: { dailyHour: Number(byId("wHour").value), lookbackDays: Number(byId("wDays").value), maxPerDigest: Number(byId("wMax").value), proxy: byId("wProxy").value, supplementOlder: byId("wSupplement").checked } }); toast("已保存"); await loadSettings(); }));
  byId("wRunAll").addEventListener("click", run(() => startWatchFromPanel()));
  byId("hostSave").addEventListener("click", run(async () => { await act("saveHostSettings", { settings: { hostMigration: byId("hostMigration").checked } }); toast("已保存迁移设置"); await loadSettings(); }));
  byId("tcSave").addEventListener("click", run(async () => { const r = await act("saveTopicCriteria", { text: byId("tcText").value }); byId("tcText").value = ""; toast("已保存" + (r.version ? "第 " + r.version + " 版" : "")); await loadSettings(); }));
  byId("s2Save").addEventListener("click", run(async () => { if (!byId("s2Key").value.trim()) throw new Error("先粘贴 key"); await act("saveS2Key", { key: byId("s2Key").value }); toast("key 已保存"); await loadSettings(); }));
  if (byId("s2Clear")) byId("s2Clear").addEventListener("click", run(async () => { await act("saveS2Key", { key: "" }); toast("key 已清除"); await loadSettings(); }));
  view.querySelectorAll(".wSaveP").forEach((b) => b.addEventListener("click", run(async (btn) => {
    const card = btn.closest(".card");
    await act("saveWatchConfig", { root: btn.dataset.root, config: { enabled: card.querySelector(".wEnabled").checked, keywords: card.querySelector(".wKeywords").value, authors: card.querySelector(".wAuthors").value, venues: card.querySelector(".wVenues").value, institutions: card.querySelector(".wInsts").value, seedPapers: card.querySelector(".wSeeds").value, categories: card.querySelector(".wCats").value, source: "user" } });
    watchCache.delete(btn.dataset.root); toast("已保存"); await loadSettings();
  })));
  view.querySelectorAll(".wDraftP").forEach((b) => b.addEventListener("click", run(async (btn) => {
    const draft = await act("draftWatchConfig", { root: btn.dataset.root });
    const card = btn.closest(".card");
    card.querySelector(".wKeywords").value = lines(draft.keywords);
    card.querySelector(".wSeeds").value = lines(draft.seedPapers);
    toast("已填入初稿（还没保存），检查后点保存");
  })));
  view.querySelectorAll(".wRunP").forEach((b) => b.addEventListener("click", run((btn) => startWatchFromPanel(btn.dataset.root))));
  view.querySelectorAll(".regRemove").forEach((b) => b.addEventListener("click", run(async (btn) => { await act("removeProject", { root: btn.dataset.root }); toast("已移出登记"); await loadSettings(); load(); })));
  byId("regAdd").addEventListener("click", run(async () => { await act("addProject", { path: byId("regPath").value.trim() }); toast("已登记"); await loadSettings(); load(); }));
  byId("regSync").addEventListener("click", run(async () => { const r = await act("syncProjects", {}); toast("更新完成：" + (r || []).map((x) => x.target.split("/").pop() + " " + x.status).join("，")); }));
  if (byId("pwSave")) byId("pwSave").addEventListener("click", run(async () => { if (byId("pw1").value !== byId("pw2").value) throw new Error("两次输入不一致"); await act("changePassword", { password: byId("pw1").value }); byId("pw1").value = byId("pw2").value = ""; toast("密码已修改"); }));
}
function setMode(next) {
  mode = next;
  document.getElementById("navProjects")?.classList.toggle("on", mode === "projects");
  document.getElementById("navTrends")?.classList.toggle("on", mode === "trends");
  document.getElementById("navSettings")?.classList.toggle("on", mode === "settings");
  document.getElementById("navTopics")?.classList.toggle("on", mode === "topics");
  if (mode === "topics") { history.replaceState(null, "", "#topics"); topics = null; renderTopics(); return; }
  if (mode === "settings") { history.replaceState(null, "", "#settings"); settings = null; renderSettings(); }
  else if (mode === "trends") { history.replaceState(null, "", "#trends"); trends = null; renderTrends(); }
  else { if (selected) history.replaceState(null, "", "#" + encodeURIComponent(selected)); renderView(); }
}
function tile(k, v) { return '<div class="tile"><div class="k">' + k + '</div><div class="v" title="' + esc(v) + '">' + esc(v) + "</div></div>"; }
function select(root) {
  selected = root;
  if (mode !== "projects") { mode = "projects"; document.getElementById("navProjects")?.classList.add("on"); document.getElementById("navSettings")?.classList.remove("on"); document.getElementById("navTrends")?.classList.remove("on"); document.getElementById("navTopics")?.classList.remove("on"); }
  history.replaceState(null, "", "#" + encodeURIComponent(root));
  renderList(); renderView();
}
async function load() {
  try {
    const res = await fetch("/api/dashboard", { cache: "no-store" });
    if (res.status === 401) { location.reload(); return; }
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || res.statusText);
    data = body;
    if (!selected || !data.projects.some((p) => p.root === selected)) selected = data.projects[0]?.root ?? null;
    document.getElementById("meta").textContent = (data.version ? "Dove " + data.version + " · " : "") + data.projects.length + " 个项目 · 更新于 " + new Date(data.generatedAt).toLocaleTimeString();
    renderList();
    if (mode === "projects") renderView();
  } catch (error) {
    document.getElementById("meta").textContent = data
      ? "刷新失败，显示的是 " + new Date(data.generatedAt).toLocaleTimeString() + " 的数据"
      : "读取失败：" + error.message;
  }
}
document.getElementById("reload").addEventListener("click", () => { texts.clear(); watchCache.clear(); load(); if (mode === "settings") loadSettings(); if (mode === "trends") loadTrends(); if (mode === "topics") loadTopics(); });
document.getElementById("navProjects")?.addEventListener("click", () => setMode("projects"));
document.getElementById("navSettings")?.addEventListener("click", () => setMode("settings"));
document.getElementById("navTrends")?.addEventListener("click", () => setMode("trends"));
document.getElementById("navTopics")?.addEventListener("click", () => setMode("topics"));
if (mode !== "projects") setMode(mode);
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
