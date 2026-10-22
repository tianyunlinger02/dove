import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readHostSettings } from "./host-migration.mjs";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
// Gateway hiccups and rate limits usually clear within seconds.
const RETRY_DELAYS_MS = [2000, 6000];

function doveConfigDirectory(env) {
  return path.join(env.XDG_CONFIG_HOME || path.join(env.HOME || os.homedir(), ".config"), "dove");
}

function imageKind(bytes) {
  if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return { type: "image/png", extension: ".png" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type: "image/jpeg", extension: ".jpg" };
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return { type: "image/webp", extension: ".webp" };
  return null;
}

function origin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

// Keys come from Dove's key file, the named variable, and, when the image API is
// the host's own model gateway, the key the host already uses for that gateway.
function figureKeys(config, baseURL, env) {
  const file = config.apiKeyFile ?? path.join(doveConfigDirectory(env), "figure-api-key");
  const keys = [];
  try {
    const key = fs.readFileSync(file, "utf8").trim();
    if (key) keys.push(key);
  } catch {
    // No key file; the other sources may still provide one.
  }
  if (config.apiKeyEnv && env[config.apiKeyEnv]?.trim()) keys.push(env[config.apiKeyEnv].trim());
  if (origin(env.ANTHROPIC_BASE_URL) === origin(baseURL)) {
    for (const name of ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_API_KEY"]) if (env[name]?.trim()) keys.push(env[name].trim());
  }
  return { keys: [...new Set(keys)], file };
}

function configuredFigure(options) {
  const env = options.env ?? process.env;
  const config = readHostSettings(options).figure ?? {};
  if (!config.baseURL || !config.model) {
    throw new Error("No image model configured: set figure.baseURL (the image API root, for example the local model gateway's /v1) and figure.model in Dove's settings.json.");
  }
  const baseURL = String(config.baseURL).trim().replace(/\/+$/u, "");
  if (!origin(baseURL)) throw new Error(`figure.baseURL is not a URL: ${config.baseURL}`);
  const { keys, file } = figureKeys(config, baseURL, env);
  if (!keys.length) throw new Error(`No key for the image API: write it to ${file}, or name an environment variable that holds it in figure.apiKeyEnv.`);
  return { baseURL, model: String(config.model).trim(), keys };
}

function freeOutputPath(file) {
  if (!fs.existsSync(file)) return file;
  const extension = path.extname(file);
  const stem = file.slice(0, file.length - extension.length);
  for (let index = 2; ; index += 1) {
    const candidate = `${stem}-${index}${extension}`;
    if (!fs.existsSync(candidate)) return candidate;
  }
}

function outputPathFor(file, kind) {
  const extension = path.extname(file).toLowerCase();
  const matches = extension === kind.extension || (kind.extension === ".jpg" && extension === ".jpeg");
  return freeOutputPath(matches ? file : `${file.slice(0, file.length - path.extname(file).length)}${kind.extension}`);
}

function redact(text, keys) {
  let result = String(text);
  for (const key of keys) result = result.split(key).join("<key>");
  return result.replace(/\s+/gu, " ").trim().slice(0, 300);
}

async function requestImage(url, body, json, keys, options) {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let last = "no response";
  for (const key of keys) {
    for (let attempt = 0; ; attempt += 1) {
      let response;
      try {
        response = await fetchImpl(url, { method: "POST", headers: { Authorization: `Bearer ${key}`, ...(json ? { "Content-Type": "application/json" } : {}) }, body });
      } catch (error) {
        last = redact(`network error: ${error?.message ?? error}`, keys);
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        throw new Error(`Image API request failed (${last}).`);
      }
      if (response.ok) return response;
      const detail = redact(await response.text().catch(() => ""), keys);
      last = `HTTP ${response.status}${detail ? `: ${detail}` : ""}`;
      if (response.status === 401 || response.status === 403) break;
      if ((response.status === 429 || response.status >= 500) && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new Error(`Image API request failed (${last}).`);
    }
  }
  throw new Error(`Image API rejected the available keys (${last}); check Dove's figure-api-key file or figure.apiKeyEnv.`);
}

async function imageBytes(result, fetchImpl) {
  const item = result?.data?.[0];
  if (typeof item?.b64_json === "string" && item.b64_json) return Buffer.from(item.b64_json, "base64");
  if (typeof item?.url === "string" && item.url.startsWith("data:")) return Buffer.from(item.url.slice(item.url.indexOf(",") + 1), "base64");
  if (typeof item?.url === "string" && /^https?:\/\//u.test(item.url)) {
    const response = await fetchImpl(item.url);
    if (!response.ok) throw new Error(`Downloading the generated image failed (HTTP ${response.status}).`);
    return Buffer.from(await response.arrayBuffer());
  }
  throw new Error("Image API returned no image (expected data[0].b64_json or data[0].url).");
}

export async function generateFigure(projectRoot, options = {}) {
  const { baseURL, model, keys } = configuredFigure(options);
  const root = path.resolve(projectRoot);
  const prompt = String(options.prompt ?? (options.promptFile ? fs.readFileSync(path.resolve(root, options.promptFile), "utf8") : "")).trim();
  if (!prompt) throw new Error("Give the image prompt with --prompt <text> or --prompt-file <file>.");
  if (!options.output) throw new Error("--output <file> is required.");
  const inputs = [].concat(options.image ?? []).map((image) => {
    const file = path.resolve(root, image);
    const bytes = fs.readFileSync(file);
    const kind = imageKind(bytes);
    if (!kind) throw new Error(`Input image is not PNG, JPEG or WebP: ${file}`);
    return { name: path.basename(file), bytes, type: kind.type };
  });
  const extra = Object.fromEntries(["size", "quality", "background"].filter((name) => options[name] !== undefined).map((name) => [name, String(options[name])]));
  let body;
  if (inputs.length) {
    body = new FormData();
    body.append("model", model);
    body.append("prompt", prompt);
    for (const image of inputs) body.append("image[]", new Blob([image.bytes], { type: image.type }), image.name);
    for (const [name, value] of Object.entries(extra)) body.append(name, value);
  } else {
    body = JSON.stringify({ model, prompt, ...extra });
  }
  const response = await requestImage(`${baseURL}/images/${inputs.length ? "edits" : "generations"}`, body, !inputs.length, keys, options);
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Image API returned a response that is not JSON.");
  }
  const bytes = await imageBytes(result, options.fetch ?? globalThis.fetch);
  const kind = imageKind(bytes);
  if (!kind) throw new Error("Image API returned data that is not a PNG, JPEG or WebP image.");
  const output = outputPathFor(path.resolve(root, options.output), kind);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, bytes, { flag: "wx" });
  return { status: "generated", mode: inputs.length ? "edit" : "generate", model, outputPath: output, inputs: inputs.length };
}

function onPath(name, env) {
  for (const directory of String(env.PATH ?? "").split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Not in this directory.
    }
  }
  return null;
}

// What this machine has for composing and exporting PPT figures.
export function figureTools(options = {}) {
  const env = options.env ?? process.env;
  const config = readHostSettings(options).figure ?? {};
  const directory = config.pptTools ?? path.join(env.HOME || os.homedir(), ".local/share/dove/figure-tools");
  const existing = (file) => (fs.existsSync(file) ? file : null);
  const exportScript = existing(path.join(directory, "scripts/export-pdf"));
  const soffice = onPath("soffice", env) ?? onPath("libreoffice", env);
  const pdftoppm = onPath("pdftoppm", env);
  return {
    imageModel: config.baseURL && config.model ? { baseURL: config.baseURL, model: config.model } : null,
    pptPython: existing(path.join(directory, "venv/bin/python")),
    exportPdf: exportScript ? `${exportScript} INPUT.pptx OUTPUT.pdf` : soffice ? `${soffice} --headless --convert-to pdf --outdir DIR INPUT.pptx` : null,
    pdfToPng: pdftoppm ? `${pdftoppm} -png -r 300 -singlefile INPUT.pdf OUTPUT` : null,
    notes: existing(path.join(directory, "README.md"))
  };
}
