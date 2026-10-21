import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { generateFigure } from "../src/core/figure-generation.mjs";
import { writeHostSettings } from "../src/core/host-migration.mjs";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8n8AAAAASUVORK5CYII=", "base64");
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
  const env = { HOME: home, XDG_CONFIG_HOME: path.join(home, ".config"), DOVE_FIXTURE_IMAGE_KEY: KEY };
  fs.mkdirSync(root);
  fs.mkdirSync(home);
  fs.writeFileSync(path.join(root, "prompt.txt"), PROMPT);
  fs.writeFileSync(path.join(root, "target.png"), PNG);
  fs.writeFileSync(path.join(root, "style.png"), PNG);
  if (config !== null) writeHostSettings({ figure: config }, { env });
  const requests = [];
  return {
    base, root, env, requests,
    options: {
      env, promptFile: "prompt.txt", output: "figures/result.png",
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

test("figure generation consumes the configured API and model and writes the returned PNG once", async (t) => {
  const f = fixture(t);
  const result = await generateFigure(f.root, f.options);
  assert.deepEqual(result, { status: "generated", mode: "generate", model: CONFIG.model, outputPath: path.join(f.root, "figures/result.png"), inputs: 0 });
  assert.deepEqual(fs.readFileSync(result.outputPath), PNG);
  assert.equal(f.requests.length, 1);
  const request = f.requests[0];
  assert.equal(request.url, "https://images.example.test/v1/images/generations");
  assert.equal(request.method, "POST");
  assert.equal(request.headers.Authorization, `Bearer ${KEY}`);
  assert.equal(request.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(request.body), { model: CONFIG.model, prompt: PROMPT });
  assert.equal(request.redirect, "error");
  assert.equal(JSON.stringify(result).includes(KEY), false);
  assert.deepEqual(fs.readFileSync(path.join(f.root, "target.png")), PNG);
});

test("figure editing sends ordered images, prompt roles and an explicit size as multipart", async (t) => {
  const f = fixture(t);
  const result = await generateFigure(f.root, { ...f.options, image: ["target.png", path.join(f.root, "style.png")], size: "1536x1024" });
  assert.equal(result.mode, "edit");
  assert.equal(result.inputs, 2);
  const request = f.requests[0];
  assert.equal(request.url, "https://images.example.test/v1/images/edits");
  assert.ok(request.body instanceof FormData);
  assert.equal(Object.hasOwn(request.headers, "Content-Type"), false, "fetch owns the multipart boundary");
  assert.equal(request.body.get("model"), CONFIG.model);
  assert.equal(request.body.get("prompt"), PROMPT);
  assert.equal(request.body.get("size"), "1536x1024");
  assert.equal(request.body.has("response_format"), false);
  const images = request.body.getAll("image[]");
  assert.deepEqual(images.map((image) => [image.name, image.type]), [["target.png", "image/png"], ["style.png", "image/png"]]);
  for (const image of images) assert.deepEqual(Buffer.from(await image.arrayBuffer()), PNG);
  assert.deepEqual(fs.readFileSync(result.outputPath), PNG);
});

test("figure passes only explicitly requested size and accepts absolute project-contained paths", async (t) => {
  const f = fixture(t);
  await generateFigure(f.root, { ...f.options, promptFile: path.join(f.root, "prompt.txt"), output: path.join(f.root, "absolute.png"), size: "1024x1536" });
  assert.equal(JSON.parse(f.requests[0].body).size, "1024x1536");
  await generateFigure(f.root, { ...f.options, promptFile: "./prompt.txt", output: "./figures/result.png", image: ["./target.png"] });
  assert.equal(f.requests[1].body.has("size"), false);
});

test("figure rejects missing or invalid API configuration before requesting or writing", async (t) => {
  const cases = [
    [null, /No figure API configured.*host.*image_gen/u],
    [[], /configuration must be an object/u],
    [{ ...CONFIG, baseURL: "" }, /figure.baseURL/u],
    [{ ...CONFIG, baseURL: "not a URL" }, /HTTP\(S\)/u],
    [{ ...CONFIG, baseURL: "file:///images" }, /HTTP\(S\)/u],
    [{ ...CONFIG, baseURL: "https://user:secret@example.test/v1" }, /without credentials/u],
    [{ ...CONFIG, baseURL: "https://example.test/v1?query=yes" }, /without credentials/u],
    [{ ...CONFIG, model: " " }, /figure.model/u],
    [{ ...CONFIG, apiKeyEnv: "literal-key-value" }, /environment variable/u]
  ];
  for (const [config, pattern] of cases) {
    const f = fixture(t, config);
    await assert.rejects(generateFigure(f.root, f.options), pattern);
    assert.equal(f.requests.length, 0);
    assert.equal(fs.existsSync(path.join(f.root, "figures")), false);
  }
  const f = fixture(t);
  delete f.env.DOVE_FIXTURE_IMAGE_KEY;
  await assert.rejects(generateFigure(f.root, f.options), /Missing figure API key environment variable: DOVE_FIXTURE_IMAGE_KEY/u);
  assert.equal(f.requests.length, 0);
});

test("figure checks prompt, inputs and output conflicts before the paid request", async (t) => {
  const cases = [
    [{ promptFile: undefined }, /--prompt-file is required/u],
    [{ output: undefined }, /--output is required/u],
    [{ promptFile: "missing.txt" }, /ENOENT/u],
    [{ output: "result.svg" }, /new PNG/u],
    [{ output: "target.png" }, /already exists/u],
    [{ output: "prompt.txt" }, /new PNG/u],
    [{ output: "../outside.png" }, /inside the rooted workspace/u],
    [{ image: ["../outside.png"] }, /inside the rooted workspace/u],
    [{ image: ["missing.png"] }, /ENOENT/u],
    [{ image: ["prompt.txt"] }, /PNG, JPEG or WebP/u],
    [{ image: "target.png" }, /must be an array/u],
    [{ output: "target.png/new.png" }, /real directory/u],
    [{ size: " " }, /--size/u]
  ];
  for (const [options, pattern] of cases) {
    const f = fixture(t);
    await assert.rejects(generateFigure(f.root, { ...f.options, ...options }), pattern);
    assert.equal(f.requests.length, 0);
    assert.deepEqual(fs.readFileSync(path.join(f.root, "target.png")), PNG);
  }
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, "prompt.txt"), " \n");
  await assert.rejects(generateFigure(f.root, f.options), /prompt file is empty/u);
  assert.equal(f.requests.length, 0);
});

test("figure reuses rooted file boundaries and never overwrites an input or raced output", async (t) => {
  const f = fixture(t);
  fs.symlinkSync(f.base, path.join(f.root, "escape"), "dir");
  await assert.rejects(generateFigure(f.root, { ...f.options, output: "escape/out.png" }), /real directory/u);
  fs.symlinkSync(path.join(f.root, "target.png"), path.join(f.root, "link.png"));
  await assert.rejects(generateFigure(f.root, { ...f.options, image: ["link.png"] }), /regular file/u);
  await assert.rejects(generateFigure(f.root, { ...f.options, output: path.join(f.base, "outside.png") }), /inside the rooted workspace/u);
  assert.equal(f.requests.length, 0);
  const outputPath = path.join(f.root, "figures/result.png");
  await assert.rejects(generateFigure(f.root, {
    ...f.options,
    fetch: async (...args) => {
      fs.writeFileSync(outputPath, "occupied while requesting");
      return f.options.fetch(...args);
    }
  }), /EEXIST/u);
  assert.equal(fs.readFileSync(outputPath, "utf8"), "occupied while requesting");
  assert.equal(f.requests.length, 1);
});

test("figure failures do not retry, leak provider echoes or write invalid output", async (t) => {
  const cases = [
    [async () => { throw new Error(KEY); }, /request failed.*No automatic retry/u],
    [async () => new Response(KEY, { status: 401 }), /HTTP 401/u],
    [async () => new Response(KEY, { status: 429 }), /HTTP 429/u],
    [async () => new Response(KEY, { status: 500 }), /HTTP 500/u],
    [async () => new Response("not JSON"), /invalid JSON/u],
    [async () => Response.json({ data: [{ url: "https://example.test/image.png" }] }), /b64_json.*URL-only/u],
    [async () => Response.json({ data: [] }), /b64_json/u],
    [async () => Response.json({ data: [{ b64_json: "" }] }), /b64_json/u],
    [async () => Response.json({ data: [{ b64_json: "not base64!" }] }), /b64_json/u],
    [async () => Response.json({ data: [{ b64_json: Buffer.from("not an image").toString("base64") }] }), /non-PNG/u],
    [async () => Response.json({ data: [{ b64_json: PNG.subarray(0, 20).toString("base64") }] }), /incomplete PNG/u]
  ];
  for (const [fetch, pattern] of cases) {
    const f = fixture(t);
    let calls = 0;
    await assert.rejects(generateFigure(f.root, {
      ...f.options, fetch: (...args) => { calls += 1; return fetch(...args); }
    }), (error) => {
      assert.match(error.message, pattern);
      assert.equal(error.message.includes(KEY), false);
      return true;
    });
    assert.equal(calls, 1);
    assert.equal(fs.existsSync(path.join(f.root, "figures/result.png")), false);
  }
});

for (const [kind, CLI] of CLI_ENTRIES) test(`${kind} CLI generates and edits against an isolated local fake Images API`, { timeout: 30_000 }, async (t) => {
  const f = fixture(t);
  const api = await fakeApi(t);
  writeHostSettings({ figure: { ...CONFIG, baseURL: api.baseURL } }, { env: f.env });
  const args = ["figure", "--project", f.root, "--prompt-file", "prompt.txt"];
  const generated = await cli(CLI, [...args, "--output", "generated.png", "--json"], f.env, f.base);
  assert.equal(generated.code, 0, generated.stderr);
  assert.deepEqual(JSON.parse(generated.stdout), { status: "generated", mode: "generate", model: CONFIG.model, outputPath: path.join(f.root, "generated.png"), inputs: 0 });
  const edited = await cli(CLI, [...args, "--image", "generated.png", "--image", "style.png", "--output", "edited.png", "--size", "1536x1024", "--format", "json"], f.env, f.base);
  assert.equal(edited.code, 0, edited.stderr);
  assert.equal(JSON.parse(edited.stdout).mode, "edit");
  assert.deepEqual(fs.readFileSync(path.join(f.root, "generated.png")), PNG);
  assert.deepEqual(fs.readFileSync(path.join(f.root, "edited.png")), PNG);
  assert.equal(api.requests.length, 2);
  assert.equal(api.requests[0].url, "/v1/images/generations");
  assert.deepEqual(JSON.parse(api.requests[0].body), { model: CONFIG.model, prompt: PROMPT });
  const edit = api.requests[1];
  assert.equal(edit.url, "/v1/images/edits");
  assert.match(edit.headers["content-type"], /^multipart\/form-data; boundary=/u);
  assert.equal(edit.headers.authorization, `Bearer ${KEY}`);
  const multipart = new Response(edit.body, { headers: { "Content-Type": edit.headers["content-type"] } });
  const form = await multipart.formData();
  assert.equal(form.get("model"), CONFIG.model);
  assert.equal(form.get("prompt"), PROMPT);
  assert.equal(form.get("size"), "1536x1024");
  assert.deepEqual(form.getAll("image[]").map((image) => image.name), ["generated.png", "style.png"]);
  const conflict = await cli(CLI, [...args, "--output", "generated.png", "--json"], f.env, f.base);
  assert.equal(conflict.code, 1);
  assert.match(JSON.parse(conflict.stderr).message, /already exists/u);
  const missing = await cli(CLI, ["figure", "--project", f.root, "--json"], f.env, f.base);
  assert.equal(missing.code, 1);
  assert.match(JSON.parse(missing.stderr).message, /--prompt-file/u);
  assert.equal(api.requests.length, 2, "invalid CLI requests never call even the local fake API");
  assert.equal((generated.stdout + generated.stderr + edited.stdout + edited.stderr + conflict.stdout + conflict.stderr).includes(KEY), false);
});
