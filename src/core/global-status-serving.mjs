import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

import { loadDoveConfig, normalizeGlobalStatusAuthConfig, normalizeGlobalStatusCloudflareConfig, resolveDoveGlobalStatusOutputDir } from "./config.mjs";
import { publishDoveGlobalStatus } from "./public-status.mjs";
import { assertGovernanceMutationRegistered } from "./workspace.mjs";

const PUBLIC_FILES = new Set(["index.html", "status.json", "status.md"]);
const PROJECT_PUBLIC_FILE_PATTERN = /^projects\/[^/]+\/(?:index\.html|status\.json|status\.md)$/;
const CONTENT_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"]
]);
const AUTH_COOKIE_NAME = "dove_global_status_auth";
const AUTH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const AUTH_LOGIN_PATH = "/__dove_global_status_login";
const LOGIN_BODY_LIMIT_BYTES = 4096;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function arrayValue(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return value === undefined || value === null ? [] : [value];
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function isInside(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeServingAuthConfig(baseConfig = {}, options = {}) {
  return normalizeGlobalStatusAuthConfig({
    ...baseConfig,
    enabled: options.auth ?? options.enableAuth ?? baseConfig.enabled,
    username: options.authUser ?? options.authUsername ?? baseConfig.username,
    password: options.authPassword ?? options.password ?? baseConfig.password,
    passwordEnv: options.authPasswordEnv ?? options.passwordEnv ?? baseConfig.passwordEnv
  });
}

function publicAuthPlan(auth) {
  if (!auth.enabled) {
    return {
      enabled: false,
      scheme: "none",
      passwordConfigured: false,
      passwordEnv: null,
      passwordEnvConfigured: false
    };
  }
  return {
    enabled: true,
    scheme: "password",
    passwordConfigured: Boolean(auth.password),
    passwordEnv: auth.passwordEnv,
    passwordEnvConfigured: Boolean(auth.passwordEnv)
  };
}

function defaultTunnelName() {
  return "dove-global-status";
}

function defaultCloudflaredConfigPath(tunnelName) {
  return path.join(os.homedir(), ".cloudflared", `${tunnelName}.yml`);
}

function normalizeServingCloudflareConfig(baseConfig, options, outputDir) {
  const raw = {
    ...baseConfig,
    enabled: options.cloudflare ?? options.enableCloudflare ?? baseConfig.enabled,
    domain: options.domain ?? options.hostname ?? baseConfig.domain,
    tunnelName: options.tunnelName ?? baseConfig.tunnelName,
    cloudflaredPath: options.cloudflaredPath ?? baseConfig.cloudflaredPath,
    originHost: options.host ?? options.originHost ?? baseConfig.originHost,
    originPort: options.port ?? options.originPort ?? baseConfig.originPort,
    configPath: options.cloudflareConfigPath ?? options.configPath ?? baseConfig.configPath,
    credentialsFile: options.credentialsFile ?? baseConfig.credentialsFile,
    tokenEnv: options.tokenEnv ?? baseConfig.tokenEnv,
    dnsResolverAddrs: options.dnsResolverAddrs ?? baseConfig.dnsResolverAddrs
  };
  const normalized = normalizeGlobalStatusCloudflareConfig(raw, {}, outputDir);
  const enabled = normalizeBoolean(raw.enabled, normalized.enabled);
  const domain = normalized.domain;
  const tunnelName = normalized.tunnelName ?? (domain ? defaultTunnelName(domain) : null);
  const configPath = normalized.configPath ?? (!normalized.tokenEnv && tunnelName ? defaultCloudflaredConfigPath(tunnelName) : null);
  return normalizeGlobalStatusCloudflareConfig({
    ...normalized,
    enabled,
    tunnelName,
    configPath
  }, {}, outputDir);
}

function safePublicPath(requestUrl) {
  const rawPath = String(requestUrl ?? "/").split("?")[0];
  try {
    if (decodeURIComponent(rawPath).split("/").includes("..")) {
      return null;
    }
  } catch {
    return null;
  }
  const url = new URL(requestUrl ?? "/", "http://127.0.0.1");
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (pathname === "/") {
    return "index.html";
  }
  if (pathname.endsWith("/")) {
    pathname = `${pathname}index.html`;
  }
  const relative = pathname.replace(/^\/+/, "");
  if (relative.split("/").includes("..")) {
    return null;
  }
  const normalized = path.posix.normalize(relative);
  if (normalized.startsWith("../") || normalized === ".." || path.posix.isAbsolute(normalized)) {
    return null;
  }
  if (PUBLIC_FILES.has(normalized) || PROJECT_PUBLIC_FILE_PATTERN.test(normalized)) {
    return normalized;
  }
  return null;
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(text);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sendPasswordPage(response, options = {}) {
  const message = options.message ? `<p>${escapeHtml(options.message)}</p>` : "";
  const returnTo = escapeHtml(options.returnTo ?? "/");
  response.writeHead(options.statusCode ?? 200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end(`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dove global status</title>
<style>
body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f7f7f8;color:#111827}
main{width:min(28rem,calc(100vw - 2rem));padding:2rem;border:1px solid #e5e7eb;border-radius:1rem;background:white;box-shadow:0 1rem 3rem rgba(15,23,42,.08)}
label,input,button{display:block;width:100%;box-sizing:border-box}input,button{font:inherit;padding:.75rem;border-radius:.5rem}input{border:1px solid #d1d5db;margin:.5rem 0 1rem}button{border:0;background:#111827;color:white;cursor:pointer}p{color:#b91c1c}
</style>
</head>
<body>
<main>
<h1>Dove global status</h1>
${message}
<form method="post" action="${AUTH_LOGIN_PATH}">
<input type="hidden" name="returnTo" value="${returnTo}">
<label>密码<input name="password" type="password" autocomplete="current-password" autofocus required></label>
<button type="submit">进入</button>
</form>
</main>
</body>
</html>`);
}

function sendAuthRequired(response) {
  response.writeHead(401, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  });
  response.end("Authentication required");
}

function constantTimeEqual(actual, expected) {
  const actualBuffer = Buffer.from(String(actual ?? ""));
  const expectedBuffer = Buffer.from(String(expected ?? ""));
  if (actualBuffer.length !== expectedBuffer.length) {
    crypto.timingSafeEqual(Buffer.alloc(expectedBuffer.length), Buffer.alloc(expectedBuffer.length));
    return false;
  }
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function parseCookies(value) {
  const cookies = new Map();
  for (const part of String(value ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }
    cookies.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim());
  }
  return cookies;
}

function authCookieValue(authOptions) {
  return crypto.createHmac("sha256", authOptions.sessionSecret).update(authOptions.password).digest("hex");
}

function parseBasicAuth(value) {
  const header = Array.isArray(value) ? value[0] : value;
  const match = /^Basic\s+(.+)$/i.exec(String(header ?? ""));
  if (!match) {
    return null;
  }
  let decoded;
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return null;
  }
  const separator = decoded.indexOf(":");
  if (separator === -1) {
    return null;
  }
  return { password: decoded.slice(separator + 1) };
}

function isAuthorized(request, authOptions) {
  if (!authOptions.enabled) {
    return true;
  }
  const cookies = parseCookies(request.headers.cookie);
  if (constantTimeEqual(cookies.get(AUTH_COOKIE_NAME), authCookieValue(authOptions))) {
    return true;
  }
  const credentials = parseBasicAuth(request.headers.authorization);
  return credentials ? constantTimeEqual(credentials.password, authOptions.password) : false;
}

function readRequestBody(request, maxBytes = LOGIN_BODY_LIMIT_BYTES) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > maxBytes) {
        reject(new Error("request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function normalizeReturnPath(value) {
  const raw = normalizeString(value) ?? "/";
  if (!raw.startsWith("/") || raw.startsWith("//") || !safePublicPath(raw)) {
    return "/";
  }
  return raw;
}

async function handlePasswordLogin(request, response, authOptions) {
  if (request.method !== "POST") {
    sendText(response, 405, "Method not allowed");
    return;
  }
  let body;
  try {
    body = await readRequestBody(request);
  } catch {
    sendText(response, 413, "Request body too large");
    return;
  }
  const params = new URLSearchParams(body);
  const returnTo = normalizeReturnPath(params.get("returnTo"));
  if (!constantTimeEqual(params.get("password"), authOptions.password)) {
    sendPasswordPage(response, { statusCode: 403, returnTo, message: "密码不正确。" });
    return;
  }
  response.writeHead(303, {
    "cache-control": "no-store",
    "set-cookie": `${AUTH_COOKIE_NAME}=${authCookieValue(authOptions)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE_SECONDS}`,
    location: returnTo
  });
  response.end();
}

function validateGlobalPublicServeRoot(outputDir) {
  const statusPath = path.join(outputDir, "status.json");
  let snapshot;
  try {
    snapshot = JSON.parse(fs.readFileSync(statusPath, "utf8"));
  } catch {
    throw new Error(`Dove global status serve root is missing a readable status.json: ${outputDir}`);
  }
  if (!isPlainObject(snapshot) || snapshot.mode !== "dove-global-public-status" || snapshot.privacy?.sanitized !== true) {
    throw new Error(`Dove global status serve root is not a sanitized global public status directory: ${outputDir}`);
  }
  return snapshot;
}

function createStaticGlobalStatusServer(outputDir, authOptions = { enabled: false }) {
  const serveRoot = path.resolve(outputDir);
  const effectiveAuthOptions = authOptions.enabled
    ? { ...authOptions, sessionSecret: authOptions.sessionSecret ?? crypto.randomBytes(32).toString("hex") }
    : { enabled: false };
  return http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (effectiveAuthOptions.enabled && url.pathname === AUTH_LOGIN_PATH) {
      void handlePasswordLogin(request, response, effectiveAuthOptions);
      return;
    }
    if (!["GET", "HEAD"].includes(request.method)) {
      sendText(response, 405, "Method not allowed");
      return;
    }
    const relativePath = safePublicPath(request.url);
    if (!relativePath) {
      sendText(response, 404, "Not found");
      return;
    }
    if (!isAuthorized(request, effectiveAuthOptions)) {
      if (relativePath.endsWith("index.html")) {
        sendPasswordPage(response, { returnTo: normalizeReturnPath(`${url.pathname}${url.search}`) });
      } else {
        sendAuthRequired(response);
      }
      return;
    }
    const filePath = path.join(serveRoot, relativePath);
    if (!isInside(filePath, serveRoot)) {
      sendText(response, 404, "Not found");
      return;
    }
    let stat;
    try {
      const linkStat = fs.lstatSync(filePath);
      if (linkStat.isSymbolicLink()) {
        sendText(response, 404, "Not found");
        return;
      }
      stat = fs.statSync(filePath);
    } catch {
      sendText(response, 404, "Not found");
      return;
    }
    if (!stat.isFile()) {
      sendText(response, 404, "Not found");
      return;
    }
    response.writeHead(200, {
      "content-type": CONTENT_TYPES.get(path.extname(filePath)) ?? "application/octet-stream",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs.createReadStream(filePath).pipe(response);
  });
}

function buildPublishOptions(options, outputDir) {
  return {
    projects: options.projects,
    projectRoots: [
      ...arrayValue(options.projectRoots),
      ...arrayValue(options.projectRoot)
    ],
    outputDir,
    refresh: Boolean(options.refresh),
    includeConfig: Boolean(options.includeConfig),
    includeArchived: Boolean(options.includeArchived),
    responseLanguage: options.responseLanguage,
    generatedAt: options.generatedAt
  };
}

function buildCloudflaredCommands(cloudflare) {
  if (!cloudflare.enabled) {
    return null;
  }
  if (!cloudflare.domain) {
    throw new Error("Dove global status Cloudflare serving requires a domain.");
  }
  if (!cloudflare.tunnelName) {
    throw new Error("Dove global status Cloudflare serving requires a tunnelName.");
  }
  const originUrl = `http://${cloudflare.originHost}:${cloudflare.originPort}`;
  const runArgs = cloudflare.tokenEnv
    ? ["tunnel", "run"]
    : (cloudflare.configPath
        ? ["tunnel", "--config", cloudflare.configPath, "run", cloudflare.tunnelName]
        : ["tunnel", "--url", originUrl, "run", cloudflare.tunnelName]);
  for (const address of cloudflare.dnsResolverAddrs ?? []) {
    runArgs.push("--dns-resolver-addrs", address);
  }
  return {
    info: { command: cloudflare.cloudflaredPath, args: ["tunnel", "info", cloudflare.tunnelName] },
    create: { command: cloudflare.cloudflaredPath, args: ["tunnel", "create", cloudflare.tunnelName] },
    routeDns: { command: cloudflare.cloudflaredPath, args: ["tunnel", "route", "dns", cloudflare.tunnelName, cloudflare.domain] },
    run: { command: cloudflare.cloudflaredPath, args: runArgs },
    tokenEnvName: cloudflare.tokenEnv ? "TUNNEL_TOKEN" : null
  };
}

function publicServingPlan(plan) {
  const cloudflare = plan.cloudflare.enabled ? {
    enabled: true,
    domain: plan.cloudflare.domain,
    tunnelName: plan.cloudflare.tunnelName,
    cloudflaredPath: plan.cloudflare.cloudflaredPath,
    originHost: plan.cloudflare.originHost,
    originPort: plan.cloudflare.originPort,
    configPath: plan.cloudflare.configPath,
    credentialsFile: plan.cloudflare.credentialsFile,
    credentialsFileConfigured: Boolean(plan.cloudflare.credentialsFile),
    tokenEnv: plan.cloudflare.tokenEnv,
    tokenEnvConfigured: Boolean(plan.cloudflare.tokenEnv),
    configureCloudflare: plan.cloudflare.configureCloudflare,
    commands: plan.cloudflare.commands
  } : {
    enabled: false,
    originHost: plan.cloudflare.originHost,
    originPort: plan.cloudflare.originPort
  };
  return {
    mode: "dove-global-status-serving-plan",
    outputDir: plan.outputDir,
    localUrl: plan.localUrl,
    publicUrl: plan.publicUrl,
    publish: plan.publish,
    auth: publicAuthPlan(plan.auth),
    dryRun: plan.dryRun,
    foreground: true,
    noDaemon: true,
    noScheduler: true,
    willStartHttpServer: !plan.dryRun,
    willStartExternalProcess: Boolean(plan.cloudflare.enabled && !plan.dryRun),
    cloudflareTunnelStarted: false,
    cloudflare
  };
}

function buildGlobalStatusServingPlanData(root, options = {}) {
  const env = options.env ?? process.env;
  const config = loadDoveConfig(root, env);
  const outputDir = resolveDoveGlobalStatusOutputDir(options.outputDir ?? config.globalStatus.outputDir, env);
  const auth = normalizeServingAuthConfig(config.globalStatus.auth, options);
  const cloudflare = normalizeServingCloudflareConfig(config.globalStatus.cloudflare, options, outputDir);
  const cloudflareEnabled = normalizeBoolean(options.cloudflare ?? options.enableCloudflare, cloudflare.enabled);
  const effectiveCloudflare = normalizeServingCloudflareConfig({
    ...cloudflare,
    enabled: cloudflareEnabled
  }, {}, outputDir);
  const configureCloudflare = Boolean(options.configureCloudflare);
  const localUrl = `http://${effectiveCloudflare.originHost}:${effectiveCloudflare.originPort}`;
  const commands = buildCloudflaredCommands(effectiveCloudflare);
  const plan = {
    root,
    outputDir,
    dryRun: Boolean(options.dryRun),
    localUrl,
    publicUrl: effectiveCloudflare.enabled && effectiveCloudflare.domain ? `https://${effectiveCloudflare.domain}` : null,
    publish: buildPublishOptions(options, outputDir),
    auth,
    cloudflare: {
      ...effectiveCloudflare,
      configureCloudflare,
      commands
    }
  };
  return plan;
}

function buildGlobalStatusServingPlan(root, options = {}) {
  return publicServingPlan(buildGlobalStatusServingPlanData(root, options));
}

function cloudflaredConfigText(cloudflare, localUrl) {
  const lines = [
    `tunnel: ${cloudflare.tunnelName}`
  ];
  if (cloudflare.credentialsFile) {
    lines.push(`credentials-file: ${cloudflare.credentialsFile}`);
  }
  lines.push("ingress:");
  lines.push(`  - hostname: ${cloudflare.domain}`);
  lines.push(`    service: ${localUrl}`);
  lines.push("  - service: http_status:404");
  return `${lines.join("\n")}\n`;
}

function writeCloudflaredConfig(plan) {
  const cloudflare = plan.cloudflare;
  if (!cloudflare.enabled || !cloudflare.configPath || cloudflare.tokenEnv) {
    return null;
  }
  fs.mkdirSync(path.dirname(cloudflare.configPath), { recursive: true });
  fs.writeFileSync(cloudflare.configPath, cloudflaredConfigText(cloudflare, plan.localUrl), "utf8");
  return cloudflare.configPath;
}

function runSetupCommand(command, args, options = {}) {
  const result = options.spawnSyncImpl(command, args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: "utf8",
    timeout: options.timeoutMs ?? 120000,
    maxBuffer: 1024 * 1024
  });
  if (result.error) {
    throw result.error;
  }
  return result;
}

function summarizeFailedCommand(label, result) {
  const stderr = normalizeString(result.stderr);
  const stdout = normalizeString(result.stdout);
  const details = stderr ?? stdout ?? `exit status ${result.status}`;
  return `${label} failed: ${details}`;
}

function configureCloudflareTunnel(plan, options = {}) {
  const logger = options.logger ?? console;
  if (!plan.cloudflare.enabled) {
    return [];
  }
  if (plan.cloudflare.tokenEnv) {
    if (plan.cloudflare.configureCloudflare) {
      throw new Error("Cloudflare tokenEnv serving cannot configure Cloudflare DNS; run without --configure-cloudflare or use cloudflared login credentials.");
    }
    return [];
  }
  const spawnSyncImpl = options.spawnSyncImpl ?? spawnSync;
  const commands = plan.cloudflare.commands;
  const completed = [];
  const info = runSetupCommand(commands.info.command, commands.info.args, { ...options, spawnSyncImpl });
  completed.push("info");
  if (info.status !== 0) {
    if (!plan.cloudflare.configureCloudflare) {
      throw new Error(`Cloudflare tunnel ${plan.cloudflare.tunnelName} is not available; rerun with --configure-cloudflare after logging in with cloudflared.`);
    }
    const created = runSetupCommand(commands.create.command, commands.create.args, { ...options, spawnSyncImpl });
    if (created.status !== 0) {
      throw new Error(summarizeFailedCommand("cloudflared tunnel create", created));
    }
    completed.push("create");
  }
  if (plan.cloudflare.configureCloudflare) {
    const routed = runSetupCommand(commands.routeDns.command, commands.routeDns.args, { ...options, spawnSyncImpl });
    if (routed.status !== 0) {
      throw new Error(summarizeFailedCommand("cloudflared tunnel route dns", routed));
    }
    completed.push("route-dns");
  }
  const configPath = writeCloudflaredConfig(plan);
  if (configPath) {
    logger.error?.(`Wrote Cloudflare tunnel config: ${configPath}`);
    completed.push("write-config");
  }
  return completed;
}

function listen(server, host, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });
}

function closeServer(server) {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

function resolveServingAuth(auth, env) {
  if (!auth.enabled) {
    return { enabled: false };
  }
  const inlinePassword = normalizeString(auth.password);
  if (inlinePassword) {
    return {
      enabled: true,
      password: inlinePassword
    };
  }
  if (!auth.passwordEnv) {
    throw new Error("Dove global status auth requires password or passwordEnv when enabled.");
  }
  const password = env[auth.passwordEnv];
  if (!password) {
    throw new Error(`Dove global status auth password environment variable is not set: ${auth.passwordEnv}`);
  }
  return {
    enabled: true,
    password
  };
}

function cloudflareChildEnv(plan, env) {
  const childEnv = { ...env };
  if (plan.auth.enabled && plan.auth.passwordEnv) {
    delete childEnv[plan.auth.passwordEnv];
  }
  if (!plan.cloudflare.enabled || !plan.cloudflare.tokenEnv) {
    return childEnv;
  }
  const tokenEnv = plan.cloudflare.tokenEnv;
  const token = env[tokenEnv];
  if (!token) {
    throw new Error(`Cloudflare tunnel token environment variable is not set: ${tokenEnv}`);
  }
  delete childEnv[tokenEnv];
  childEnv.TUNNEL_TOKEN = token;
  return childEnv;
}

export async function runGlobalStatusServingForeground(root, options = {}) {
  assertGovernanceMutationRegistered("serve-dove-global-status", "exempt");
  const privatePlan = buildGlobalStatusServingPlanData(root, options);
  const plan = publicServingPlan(privatePlan);
  if (plan.dryRun) {
    return plan;
  }
  const logger = options.logger ?? console;
  const env = options.env ?? process.env;
  const authOptions = resolveServingAuth(privatePlan.auth, env);
  const publish = publishDoveGlobalStatus(root, privatePlan.publish);
  validateGlobalPublicServeRoot(privatePlan.outputDir);
  const server = createStaticGlobalStatusServer(privatePlan.outputDir, authOptions);
  await listen(server, privatePlan.cloudflare.originHost, privatePlan.cloudflare.originPort);
  let child = null;
  let configured = [];
  try {
    if (privatePlan.cloudflare.enabled) {
      configured = configureCloudflareTunnel(privatePlan, {
        spawnSyncImpl: options.spawnSyncImpl ?? spawnSync,
        logger
      });
      child = (options.spawnImpl ?? spawn)(privatePlan.cloudflare.commands.run.command, privatePlan.cloudflare.commands.run.args, {
        cwd: options.cwd ?? process.cwd(),
        env: cloudflareChildEnv(privatePlan, env),
        stdio: "inherit",
        detached: false
      });
    }
  } catch (error) {
    await closeServer(server);
    throw error;
  }

  logger.error?.(`Dove global status local URL: ${plan.localUrl}`);
  if (plan.publicUrl) {
    logger.error?.(`Dove global status public URL: ${plan.publicUrl}`);
  }

  return await new Promise((resolve, reject) => {
    let closed = false;
    const finish = async (status, detail = {}) => {
      if (closed) {
        return;
      }
      closed = true;
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      if (child && !child.killed) {
        child.kill("SIGTERM");
      }
      await closeServer(server);
      resolve({
        mode: "dove-global-status-serving",
        status,
        outputDir: plan.outputDir,
        localUrl: plan.localUrl,
        publicUrl: plan.publicUrl,
        publish,
        auth: plan.auth,
        configured,
        noDaemon: true,
        noScheduler: true,
        foreground: true,
        noExternalProcess: !plan.cloudflare.enabled,
        cloudflareTunnelStarted: Boolean(plan.cloudflare.enabled),
        ...detail
      });
    };
    const onSignal = () => {
      void finish("stopped", { signal: "operator-stop" });
    };
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
    if (child) {
      child.once("error", async (error) => {
        if (!closed) {
          process.off("SIGINT", onSignal);
          process.off("SIGTERM", onSignal);
          await closeServer(server);
          reject(error);
        }
      });
      child.once("exit", (code, signal) => {
        void finish(code === 0 ? "stopped" : "cloudflared-exited", { cloudflaredExitCode: code, cloudflaredSignal: signal });
      });
    }
  });
}

export { buildGlobalStatusServingPlan, createStaticGlobalStatusServer, validateGlobalPublicServeRoot };
