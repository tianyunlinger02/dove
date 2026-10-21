import path from "node:path";

import { readHostSettings } from "./host-migration.mjs";
import { openRootedFilesystem } from "./rooted-filesystem.mjs";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function configuredFigure(options) {
  const config = readHostSettings(options).figure;
  if (config === undefined) {
    throw new Error("No figure API configured. Set figure.baseURL, figure.model and figure.apiKeyEnv in Dove user settings.json, or use the host's image tools directly; this CLI cannot invoke host image_gen.");
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Dove figure configuration must be an object.");
  for (const field of ["baseURL", "model", "apiKeyEnv"]) {
    if (typeof config[field] !== "string" || !config[field].trim()) throw new Error(`Dove figure.${field} must be a non-empty string.`);
  }
  let baseURL;
  try {
    baseURL = new URL(config.baseURL);
  } catch {
    throw new Error("Dove figure.baseURL must be an HTTP(S) API root URL.");
  }
  if (!["http:", "https:"].includes(baseURL.protocol) || baseURL.username || baseURL.password || baseURL.search || baseURL.hash) {
    throw new Error("Dove figure.baseURL must be an HTTP(S) API root URL without credentials, query or fragment.");
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(config.apiKeyEnv)) throw new Error("Dove figure.apiKeyEnv must name an environment variable, not contain a key.");
  const apiKey = (options.env ?? process.env)[config.apiKeyEnv];
  if (typeof apiKey !== "string" || !apiKey.trim()) throw new Error(`Missing figure API key environment variable: ${config.apiKeyEnv}.`);
  return { baseURL: baseURL.href.replace(/\/+$/u, ""), model: config.model.trim(), apiKey };
}

function projectPath(root, projectRoot, supplied, label) {
  if (typeof supplied !== "string" || !supplied.trim()) throw new Error(`${label} is required.`);
  const relative = path.relative(path.resolve(projectRoot), path.resolve(projectRoot, supplied)).split(path.sep).join("/");
  return root.normalize(relative, label);
}

function imageType(bytes) {
  if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  throw new Error("Figure inputs must be PNG, JPEG or WebP images.");
}

function decodePng(value) {
  if (typeof value !== "string" || !value.length || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(value)) {
    throw new Error("Figure API did not return valid data[0].b64_json; URL-only responses are not supported.");
  }
  const bytes = Buffer.from(value, "base64");
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("Figure API returned a non-PNG image or invalid image data; no output was written.");
  let offset = 8;
  let hasPixels = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (offset + 12 + length > bytes.length) break;
    if (offset === 8 && (type !== "IHDR" || length !== 13 || bytes.readUInt32BE(offset + 8) === 0 || bytes.readUInt32BE(offset + 12) === 0)) break;
    if (type === "IDAT" && length > 0) hasPixels = true;
    offset += length + 12;
    if (type === "IEND") {
      if (hasPixels && length === 0 && offset === bytes.length) return bytes;
      break;
    }
  }
  throw new Error("Figure API returned incomplete PNG image data; no output was written.");
}

export async function generateFigure(projectRoot, options = {}) {
  const { baseURL, model, apiKey } = configuredFigure(options);
  const root = openRootedFilesystem(projectRoot, options);
  const promptPath = projectPath(root, projectRoot, options.promptFile, "--prompt-file");
  const output = projectPath(root, projectRoot, options.output, "--output");
  if (path.extname(output).toLowerCase() !== ".png") throw new Error("--output must name a new PNG file.");
  if (root.exists(output)) throw new Error("Figure output already exists; choose a new --output path.");
  const prompt = root.readFile(promptPath).toString("utf8").trim();
  if (!prompt) throw new Error("Figure prompt file is empty.");
  const images = options.image ?? [];
  if (!Array.isArray(images)) throw new Error("Figure image inputs must be an array.");
  const inputs = images.map((image) => {
    const relative = projectPath(root, projectRoot, image, "--image");
    const bytes = root.readFile(relative);
    return { name: path.posix.basename(relative), bytes, type: imageType(bytes) };
  });
  if (options.size !== undefined && (typeof options.size !== "string" || !options.size.trim())) throw new Error("--size must be a non-empty model-supported size.");
  const mode = inputs.length ? "edit" : "generate";
  const headers = { Authorization: `Bearer ${apiKey}` };
  let body;
  if (inputs.length) {
    body = new FormData();
    body.append("model", model);
    body.append("prompt", prompt);
    for (const image of inputs) body.append("image[]", new Blob([image.bytes], { type: image.type }), image.name);
    if (options.size !== undefined) body.append("size", options.size);
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ model, prompt, ...(options.size === undefined ? {} : { size: options.size }) });
  }
  const parent = path.posix.dirname(output);
  if (parent !== ".") root.mkdir(parent, { recursive: true });
  let response;
  try {
    response = await (options.fetch ?? globalThis.fetch)(`${baseURL}/images/${inputs.length ? "edits" : "generations"}`, {
      method: "POST", headers, body, redirect: "error"
    });
  } catch {
    throw new Error("Figure API request failed; check the configured service and connection. No automatic retry was made.");
  }
  if (!response.ok) throw new Error(`Figure API request failed (HTTP ${response.status}); check the service, model and credentials. No automatic retry was made.`);
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Figure API returned invalid JSON; no output was written.");
  }
  const png = decodePng(result?.data?.[0]?.b64_json);
  root.writeNewFile(output, png);
  return { status: "generated", mode, model, outputPath: root.displayPath(output), inputs: inputs.length };
}
