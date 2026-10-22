import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { figureTools, generateFigure } from "../src/core/figure-generation.mjs";
import { writeHostSettings } from "../src/core/host-migration.mjs";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8n8AAAAASUVORK5CYII=", "base64");
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]);
const CONFIG = { baseURL: "https://images.example.test/v1/", model: "configured-image-model", apiKeyEnv: "DOVE_FIXTURE_IMAGE_KEY" };
const KEY = "synthetic-key-not-a-credential";
const PROMPT = "Draw the mechanism. Image 1 is the edit target; image 2 is a style reference. Preserve the scientific relationships.";
const CLI_ENTRIES = [
  ["source", fileURLToPath(new URL("../bin/dove.mjs", import.meta.url))],
  ["bundled", fileURLToPath(new URL("../bin/dove-package.mjs", import.meta.url))]
];

function fixture(t, config = CONFIG) {
  const scratch = process.env.DOVE_TEMP_ROOT ?? path.resolve(".claude-tmp/dove-figure-test");
  fs.mkdirSync(scratch, { recursive: true });
  const base = fs.mkdtempSync(path.join(scratch, "dove-figure-"));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, "project");
  const home = path.join(base, "home");
  const env = { HOME: home, XDG_CONFIG_HOME: path.join(home, ".config"), DOVE_FIXTURE_IMAGE_KEY: KEY, PATH: "" };
  fs.mkdirSync(root);
  fs.mkdirSync(home);
  fs.writeFileSync(path.join(root, "prompt.txt"), PROMPT);
  fs.writeFileSync(path.join(root, "target.png"), PNG);
  fs.writeFileSync(path.join(root, "style.png"), PNG);
  if (config !== null) writeHostSettings({ figure: config }, { env });
  const requests = [];
  return {
    base, root, home, env, requests,
    options: {
      env, promptFile: "prompt.txt", output: "figures/result.png", sleep: async () => {},
      fetch: async (url, init) => {
        requests.push({ url, ...init });
        return Response.json({ data: [{ b64_json: PNG.toString("base64") }] });
      }
    }
  };
}

function cli(entry, args, env, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry, ...args], { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (data) => { stdout += data; });
    child.stderr.setEncoding("utf8").on("data", (data) => { stderr += data; });
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

async function fakeApi(t) {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    requests.push({ method: request.method, url: request.url, headers: request.headers, body: Buffer.concat(chunks) });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ b64_json: PNG.toString("base64") }] }));
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return { requests, baseURL: `http://127.0.0.1:${server.address().port}/v1` };
}

test("generation sends the prompt and requested options to the configured model and writes the image", async (t) => {
  const f = fixture(t);
  const result = await generateFigure(f.root, { ...f.options, size: "1536x1024", quality: "high", background: "transparent" });
  assert.deepEqual(result, { status: "generated", mode: "generate", model: CONFIG.model, outputPath: path.join(f.root, "figures/result.png"), inputs: 0 });
  assert.deepEqual(fs.readFileSync(result.outputPath), PNG);
  assert.equal(f.requests.length, 1);
  const request = f.requests[0];
  assert.equal(request.url, "https://images.example.test/v1/images/generations");
  assert.equal(request.headers.Authorization, `Bearer ${KEY}`);
  assert.deepEqual(JSON.parse(request.body), { model: CONFIG.model, prompt: PROMPT, size: "1536x1024", quality: "high", background: "transparent" });
  const inline = await generateFigure(f.root, { ...f.options, promptFile: undefined, prompt: "Inline prompt", output: "inline.png" });
  assert.equal(JSON.parse(f.requests[1].body).prompt, "Inline prompt");
  assert.equal(inline.outputPath, path.join(f.root, "inline.png"));
});

test("editing sends ordered images from anywhere on disk as multipart", async (t) => {
  const f = fixture(t);
  const elsewhere = path.join(f.base, "references");
  fs.mkdirSync(elsewhere);
  fs.writeFileSync(path.join(elsewhere, "paper-figure.jpg"), JPEG);
  const result = await generateFigure(f.root, { ...f.options, image: ["target.png", path.join(elsewhere, "paper-figure.jpg")], output: path.join(f.base, "out/edited.png") });
  assert.equal(result.mode, "edit");
  assert.equal(result.outputPath, path.join(f.base, "out/edited.png"));
  const request = f.requests[0];
  assert.equal(request.url, "https://images.example.test/v1/images/edits");
  assert.ok(request.body instanceof FormData);
  assert.equal(Object.hasOwn(request.headers, "Content-Type"), false, "fetch owns the multipart boundary");
  assert.equal(request.body.get("model"), CONFIG.model);
  assert.equal(request.body.get("prompt"), PROMPT);
  assert.deepEqual(request.body.getAll("image[]").map((image) => [image.name, image.type]), [["target.png", "image/png"], ["paper-figure.jpg", "image/jpeg"]]);
});

test("the key comes from Dove's key file, the named variable, or the host gateway it already uses", async (t) => {
  const f = fixture(t, { baseURL: "http://127.0.0.1:8317/v1", model: CONFIG.model });
  await assert.rejects(generateFigure(f.root, f.options), /No key for the image API: write it to .*figure-api-key/u);
  assert.equal(f.requests.length, 0);
  const gatewayEnv = { ...f.env, ANTHROPIC_BASE_URL: "http://127.0.0.1:8317", ANTHROPIC_AUTH_TOKEN: "host-token" };
  await generateFigure(f.root, { ...f.options, env: gatewayEnv });
  assert.equal(f.requests[0].headers.Authorization, "Bearer host-token");
  fs.writeFileSync(path.join(f.env.XDG_CONFIG_HOME, "dove/figure-api-key"), "file-key\n");
  await generateFigure(f.root, { ...f.options, env: gatewayEnv });
  assert.equal(f.requests[1].headers.Authorization, "Bearer file-key");
  const otherGateway = { ...gatewayEnv, ANTHROPIC_BASE_URL: "https://elsewhere.example.test" };
  fs.rmSync(path.join(f.env.XDG_CONFIG_HOME, "dove/figure-api-key"));
  await assert.rejects(generateFigure(f.root, { ...f.options, env: otherGateway }), /No key for the image API/u, "a key for another gateway is never sent here");
});

test("a rejected key falls through to the next one, and transient failures retry", async (t) => {
  const f = fixture(t, { baseURL: "http://127.0.0.1:8317/v1", model: CONFIG.model, apiKeyEnv: "DOVE_FIXTURE_IMAGE_KEY" });
  const env = { ...f.env, ANTHROPIC_BASE_URL: "http://127.0.0.1:8317", ANTHROPIC_API_KEY: "host-api-key" };
  const replies = [new Response(`invalid key ${KEY}`, { status: 401 }), new Response("upstream busy", { status: 503 }), new Response("slow down", { status: 429 })];
  const seen = [];
  const result = await generateFigure(f.root, {
    ...f.options, env,
    fetch: async (url, init) => {
      seen.push(init.headers.Authorization);
      return replies.shift() ?? Response.json({ data: [{ b64_json: PNG.toString("base64") }] });
    }
  });
  assert.equal(result.status, "generated");
  assert.deepEqual(seen, [`Bearer ${KEY}`, "Bearer host-api-key", "Bearer host-api-key", "Bearer host-api-key"]);
  await assert.rejects(generateFigure(f.root, {
    ...f.options, env, output: "never.png",
    fetch: async () => new Response(`model not found for ${KEY}`, { status: 404 })
  }), (error) => {
    assert.match(error.message, /HTTP 404: model not found for <key>/u);
    return true;
  });
  assert.equal(fs.existsSync(path.join(f.root, "never.png")), false);
});

test("URL and JPEG results are saved under a free name with the matching extension", async (t) => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.root, "figures"));
  fs.writeFileSync(path.join(f.root, "figures/result.jpg"), "earlier iteration");
  const result = await generateFigure(f.root, {
    ...f.options,
    fetch: async (url) => (url === "https://cdn.example.test/out.jpg" ? new Response(JPEG) : Response.json({ data: [{ url: "https://cdn.example.test/out.jpg" }] }))
  });
  assert.equal(result.outputPath, path.join(f.root, "figures/result-2.jpg"));
  assert.deepEqual(fs.readFileSync(result.outputPath), JPEG);
  assert.equal(fs.readFileSync(path.join(f.root, "figures/result.jpg"), "utf8"), "earlier iteration");
});

test("missing configuration, prompt or output is reported before any request", async (t) => {
  for (const [config, options, pattern] of [
    [null, {}, /No image model configured/u],
    [{ ...CONFIG, model: "" }, {}, /No image model configured/u],
    [{ ...CONFIG, baseURL: "not a URL" }, {}, /not a URL/u],
    [CONFIG, { promptFile: undefined }, /--prompt <text> or --prompt-file/u],
    [CONFIG, { output: undefined }, /--output/u],
    [CONFIG, { image: ["prompt.txt"] }, /not PNG, JPEG or WebP/u]
  ]) {
    const f = fixture(t, config);
    await assert.rejects(generateFigure(f.root, { ...f.options, ...options }), pattern);
    assert.equal(f.requests.length, 0);
  }
});

test("figure tools reports this machine's PPT authoring and export commands", (t) => {
  const f = fixture(t);
  const tools = path.join(f.home, ".local/share/dove/figure-tools");
  fs.mkdirSync(path.join(tools, "venv/bin"), { recursive: true });
  fs.mkdirSync(path.join(tools, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(tools, "venv/bin/python"), "");
  fs.writeFileSync(path.join(tools, "scripts/export-pdf"), "");
  fs.writeFileSync(path.join(tools, "README.md"), "notes");
  const bin = path.join(f.base, "bin");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "pdftoppm"), "#!/bin/sh\n", { mode: 0o755 });
  const found = figureTools({ env: { ...f.env, PATH: bin } });
  assert.deepEqual(found.imageModel, { baseURL: CONFIG.baseURL, model: CONFIG.model });
  assert.equal(found.pptPython, path.join(tools, "venv/bin/python"));
  assert.equal(found.exportPdf, `${path.join(tools, "scripts/export-pdf")} INPUT.pptx OUTPUT.pdf`);
  assert.equal(found.pdfToPng, `${path.join(bin, "pdftoppm")} -png -r 300 -singlefile INPUT.pdf OUTPUT`);
  assert.equal(found.notes, path.join(tools, "README.md"));
  const none = figureTools({ env: { ...f.env, HOME: f.base } });
  assert.deepEqual([none.pptPython, none.exportPdf, none.pdfToPng], [null, null, null]);
});

for (const [kind, CLI] of CLI_ENTRIES) test(`${kind} CLI generates and edits against an isolated local fake Images API`, { timeout: 30_000 }, async (t) => {
  const f = fixture(t);
  const api = await fakeApi(t);
  writeHostSettings({ figure: { ...CONFIG, baseURL: api.baseURL } }, { env: f.env });
  const args = ["figure", "--project", f.root, "--prompt-file", "prompt.txt"];
  const generated = await cli(CLI, [...args, "--output", "generated.png", "--json"], f.env, f.base);
  assert.equal(generated.code, 0, generated.stderr);
  assert.deepEqual(JSON.parse(generated.stdout), { status: "generated", mode: "generate", model: CONFIG.model, outputPath: path.join(f.root, "generated.png"), inputs: 0 });
  const edited = await cli(CLI, [...args, "--image", "generated.png", "--image", "style.png", "--output", "generated.png", "--size", "1536x1024", "--quality", "high", "--format", "json"], f.env, f.base);
  assert.equal(edited.code, 0, edited.stderr);
  assert.equal(JSON.parse(edited.stdout).outputPath, path.join(f.root, "generated-2.png"), "an existing output is never overwritten");
  assert.equal(api.requests.length, 2);
  const edit = api.requests[1];
  assert.equal(edit.url, "/v1/images/edits");
  assert.equal(edit.headers.authorization, `Bearer ${KEY}`);
  const form = await new Response(edit.body, { headers: { "Content-Type": edit.headers["content-type"] } }).formData();
  assert.equal(form.get("quality"), "high");
  assert.deepEqual(form.getAll("image[]").map((image) => image.name), ["generated.png", "style.png"]);
  const inline = await cli(CLI, ["figure", "--project", f.root, "--prompt", "Inline", "--output", "inline.png", "--json"], f.env, f.base);
  assert.equal(inline.code, 0, inline.stderr);
  const tools = await cli(CLI, ["figure", "--tools", "--json"], f.env, f.base);
  assert.equal(tools.code, 0, tools.stderr);
  assert.equal(JSON.parse(tools.stdout).imageModel.model, CONFIG.model);
  const missing = await cli(CLI, ["figure", "--project", f.root, "--output", "x.png", "--json"], f.env, f.base);
  assert.equal(missing.code, 1);
  assert.match(JSON.parse(missing.stderr).message, /--prompt/u);
  assert.equal((generated.stdout + generated.stderr + edited.stdout + edited.stderr).includes(KEY), false);
});
