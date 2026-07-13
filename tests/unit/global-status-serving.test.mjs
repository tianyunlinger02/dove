import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import { buildGlobalStatusServingPlan, createStaticGlobalStatusServer, runGlobalStatusServingForeground, validateGlobalPublicServeRoot } from "../../src/core/internal-api.mjs";
import { runFixtureMutation } from "../helpers/mutation-fixture.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function tempRoot() {
  return createTempRoot("dove-global-serving-");
}

function writeGlobalPublicStatus(outputDir) {
  fs.mkdirSync(path.join(outputDir, "projects", "paper-factory"), { recursive: true });
  fs.writeFileSync(path.join(outputDir, "status.json"), `${JSON.stringify({
    version: 1,
    mode: "dove-global-public-status",
    generatedAt: "2026-06-17T00:00:00.000Z",
    counts: { configured: 1, published: 1, missing: 0, invalid: 0, skipped: 0 },
    projects: [],
    privacy: { sanitized: true, absoluteRootsIncluded: false }
  }, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(outputDir, "index.html"), "<h1>Dove</h1>\n", "utf8");
  fs.writeFileSync(path.join(outputDir, "status.md"), "# Dove\n", "utf8");
  fs.writeFileSync(path.join(outputDir, "projects", "paper-factory", "index.html"), "<h1>Project</h1>\n", "utf8");
  fs.writeFileSync(path.join(outputDir, "projects", "paper-factory", "status.json"), "{}\n", "utf8");
  fs.writeFileSync(path.join(outputDir, "projects", "paper-factory", "status.md"), "# Project\n", "utf8");
}

function request(port, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: pathname, method: options.method ?? "GET", headers: options.headers }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => resolve({ statusCode: res.statusCode, body, headers: res.headers }));
    });
    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function formBody(fields) {
  return new URLSearchParams(fields).toString();
}

function basicAuth(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

test("global status serving dry-run redacts direct and env password configuration", () => {
  const root = tempRoot();
  const outputDir = path.join(root, "global-public");
  const configPath = path.join(root, "config.json");
  try {
    fs.writeFileSync(configPath, JSON.stringify({
      globalStatus: {
        outputDir,
        auth: {
          enabled: true,
          password: "inline-page-secret",
          passwordEnv: "DOVE_GLOBAL_STATUS_PASSWORD"
        },
        cloudflare: {
          enabled: true,
          domain: "keli.eu.cc",
          tunnelName: "dove-global-status",
          originHost: "127.0.0.1",
          originPort: 8787,
          tokenEnv: "DOVE_CLOUDFLARE_TUNNEL_TOKEN",
          dnsResolverAddrs: ["1.1.1.1:53", "1.0.0.1:53"]
        }
      }
    }), "utf8");

    const plan = buildGlobalStatusServingPlan(root, {
      env: { DOVE_CONFIG_PATH: configPath, DOVE_GLOBAL_STATUS_PASSWORD: "page-secret" },
      dryRun: true,
      refresh: true
    });

    assert.equal(plan.mode, "dove-global-status-serving-plan");
    assert.equal(plan.dryRun, true);
    assert.equal(plan.willStartHttpServer, false);
    assert.equal(plan.willStartExternalProcess, false);
    assert.equal(plan.auth.enabled, true);
    assert.equal(plan.auth.scheme, "password");
    assert.equal(plan.auth.passwordConfigured, true);
    assert.equal(plan.auth.passwordEnv, "DOVE_GLOBAL_STATUS_PASSWORD");
    assert.equal(plan.auth.passwordEnvConfigured, true);
    assert.equal(plan.cloudflare.enabled, true);
    assert.equal(plan.cloudflare.domain, "keli.eu.cc");
    assert.equal(plan.cloudflare.tokenEnvConfigured, true);
    assert.equal(plan.cloudflare.commands.run.command, "cloudflared");
    assert.deepEqual(plan.cloudflare.commands.routeDns.args, ["tunnel", "route", "dns", "dove-global-status", "keli.eu.cc"]);
    assert.deepEqual(plan.cloudflare.commands.run.args, ["tunnel", "run", "--dns-resolver-addrs", "1.1.1.1:53", "--dns-resolver-addrs", "1.0.0.1:53"]);
    assert.equal(JSON.stringify(plan).includes("inline-page-secret"), false);
    assert.equal(JSON.stringify(plan).includes("page-secret"), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("static global status server only serves sanitized public files", async () => {
  const root = tempRoot();
  const outputDir = path.join(root, "global-public");
  try {
    writeGlobalPublicStatus(outputDir);
    const snapshot = validateGlobalPublicServeRoot(outputDir);
    assert.equal(snapshot.mode, "dove-global-public-status");

    const server = createStaticGlobalStatusServer(outputDir);
    const port = await listen(server);
    try {
      assert.equal((await request(port, "/")).statusCode, 200);
      assert.equal((await request(port, "/status.json")).statusCode, 200);
      assert.equal((await request(port, "/projects/paper-factory/status.md")).statusCode, 200);
      assert.equal((await request(port, "/projects/paper-factory/")).statusCode, 200);
      assert.equal((await request(port, "/projects")).statusCode, 404);
      assert.equal((await request(port, "/.dove/state.json")).statusCode, 404);
      assert.equal((await request(port, "/projects/%2e%2e/status.json")).statusCode, 404);
      fs.writeFileSync(path.join(root, "private.md"), "private\n", "utf8");
      fs.unlinkSync(path.join(outputDir, "projects", "paper-factory", "status.md"));
      fs.symlinkSync(path.join(root, "private.md"), path.join(outputDir, "projects", "paper-factory", "status.md"));
      assert.equal((await request(port, "/projects/paper-factory/status.md")).statusCode, 404);
    } finally {
      await close(server);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("static global status server uses password-only login when configured", async () => {
  const root = tempRoot();
  const outputDir = path.join(root, "global-public");
  try {
    writeGlobalPublicStatus(outputDir);
    const server = createStaticGlobalStatusServer(outputDir, {
      enabled: true,
      password: "correct-password",
      sessionSecret: "test-session-secret"
    });
    const port = await listen(server);
    try {
      const noAuth = await request(port, "/");
      assert.equal(noAuth.statusCode, 200);
      assert.equal(noAuth.headers["www-authenticate"], undefined);
      assert.match(noAuth.body, /name="password"/);
      assert.doesNotMatch(noAuth.body, /username/i);
      assert.equal((await request(port, "/status.json")).statusCode, 401);
      assert.equal((await request(port, "/", { headers: { authorization: basicAuth("anything", "correct-password") } })).statusCode, 200);

      const wrong = await request(port, "/__dove_global_status_login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: formBody({ password: "wrong", returnTo: "/" })
      });
      assert.equal(wrong.statusCode, 403);
      assert.match(wrong.body, /密码不正确/);

      const login = await request(port, "/__dove_global_status_login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: formBody({ password: "correct-password", returnTo: "/projects/paper-factory/status.json" })
      });
      assert.equal(login.statusCode, 303);
      assert.equal(login.headers.location, "/projects/paper-factory/status.json");
      const cookie = login.headers["set-cookie"][0].split(";")[0];
      assert.equal((await request(port, "/", { headers: { cookie } })).statusCode, 200);
      assert.equal((await request(port, "/projects/paper-factory/status.json", { headers: { cookie } })).statusCode, 200);
      assert.equal((await request(port, "/.dove/state.json")).statusCode, 404);
      assert.equal((await request(port, "/projects/%2e%2e/status.json")).statusCode, 404);
    } finally {
      await close(server);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("auth serving fails fast when password environment variable is missing", async () => {
  const root = tempRoot();
  const outputDir = path.join(root, "global-public");
  const configPath = path.join(root, "config.json");
  try {
    fs.writeFileSync(configPath, JSON.stringify({
      globalStatus: {
        outputDir,
        auth: {
          enabled: true,
          passwordEnv: "DOVE_GLOBAL_STATUS_PASSWORD"
        }
      }
    }), "utf8");

    await assert.rejects(() => runGlobalStatusServingForeground(root, {
      env: { DOVE_CONFIG_PATH: configPath }
    }), /auth password environment variable is not set/);
    assert.equal(fs.existsSync(path.join(outputDir, "status.json")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("tokenEnv serving only passes TUNNEL_TOKEN to cloudflared", async () => {
  const root = tempRoot();
  const outputDir = path.join(root, "global-public");
  const configPath = path.join(root, "config.json");
  let childEnv = null;
  try {
    fs.writeFileSync(configPath, JSON.stringify({
      globalStatus: {
        outputDir,
        auth: {
          enabled: true,
          passwordEnv: "DOVE_GLOBAL_STATUS_PASSWORD"
        },
        cloudflare: {
          enabled: true,
          domain: "keli.eu.cc",
          tunnelName: "dove-global-status",
          originPort: 18787,
          tokenEnv: "DOVE_CLOUDFLARE_TUNNEL_TOKEN"
        }
      }
    }), "utf8");

    const result = await runFixtureMutation(root, "token-env-serving", () => runGlobalStatusServingForeground(root, {
      env: {
        DOVE_CONFIG_PATH: configPath,
        DOVE_CLOUDFLARE_TUNNEL_TOKEN: "secret-token",
        DOVE_GLOBAL_STATUS_PASSWORD: "page-secret",
        KEEP_ME: "yes"
      },
      spawnImpl: (command, args, options) => {
        assert.equal(command, "cloudflared");
        assert.deepEqual(args, ["tunnel", "run"]);
        childEnv = options.env;
        const child = new EventEmitter();
        child.killed = false;
        child.kill = () => {
          child.killed = true;
        };
        process.nextTick(() => child.emit("exit", 0, null));
        return child;
      }
    }));

    assert.equal(result.status, "stopped");
    assert.equal(childEnv.TUNNEL_TOKEN, "secret-token");
    assert.equal(childEnv.DOVE_CLOUDFLARE_TUNNEL_TOKEN, undefined);
    assert.equal(childEnv.DOVE_GLOBAL_STATUS_PASSWORD, undefined);
    assert.equal(childEnv.KEEP_ME, "yes");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("serve root validation rejects non-global public status directories", () => {
  const root = tempRoot();
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, "status.json"), JSON.stringify({ mode: "dove-public-status", privacy: { sanitized: true } }), "utf8");
    assert.throws(() => validateGlobalPublicServeRoot(root), /sanitized global public status/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
