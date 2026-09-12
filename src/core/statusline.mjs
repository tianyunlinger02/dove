import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const STATUS_SEPARATOR = " · ";
const CONTROL_CHARACTERS = /[\x00-\x1f\x7f-\x9f]/gu;
const CAPACITY_IN_MODEL_NAME = /\b\d+(?:\.\d+)?\s*[KMG](?:\s+context)?\b/iu;

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function oneLine(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(CONTROL_CHARACTERS, "?");
  return normalized || null;
}

function nonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function parseDoveStatusLinePayload(input) {
  try {
    const value = JSON.parse(input);
    return plainObject(value) ? value : {};
  } catch {
    return {};
  }
}

export function formatContextCapacity(value) {
  const size = nonNegativeNumber(value);
  if (size === null || size === 0) return null;
  if (size >= 1_000_000) return `${Number((size / 1_000_000).toFixed(1))}M`;
  if (size >= 1_000) return `${Math.round(size / 1_000)}K`;
  return String(Math.round(size));
}

export function formatSessionDuration(value) {
  const milliseconds = nonNegativeNumber(value);
  if (milliseconds === null) return null;
  const minutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h${minutes % 60}m` : `${minutes}m`;
}

export function inspectGitBranch(projectRoot, options = {}) {
  const run = options.spawnSync ?? spawnSync;
  try {
    const result = run("git", ["branch", "--show-current"], {
      cwd: projectRoot,
      encoding: "utf8",
      timeout: options.timeoutMs ?? 500,
      maxBuffer: 64 * 1024,
      windowsHide: true,
      env: {
        ...process.env,
        GIT_CEILING_DIRECTORIES: path.dirname(path.resolve(projectRoot))
      }
    });
    if (result?.status !== 0 || result.signal || result.error) return null;
    return oneLine(result.stdout);
  } catch {
    return null;
  }
}

export function renderDoveStatusLine(input, options = {}) {
  const payload = typeof input === "string" ? parseDoveStatusLinePayload(input) : plainObject(input) ? input : {};
  const model = oneLine(payload.model?.display_name);
  const capacity = formatContextCapacity(payload.context_window?.context_window_size);
  const remainingValue = nonNegativeNumber(payload.context_window?.remaining_percentage);
  const remaining = remainingValue === null ? null : Math.min(100, Math.round(remainingValue));
  const duration = formatSessionDuration(payload.cost?.total_duration_ms);
  const project = oneLine(options.projectRoot);
  const branch = Object.hasOwn(options, "branch")
    ? oneLine(options.branch)
    : inspectGitBranch(options.projectRoot, options);

  const parts = [];
  if (model) parts.push(capacity && !CAPACITY_IN_MODEL_NAME.test(model) ? `${model} (${capacity})` : model);
  else if (capacity) parts.push(`ctx ${capacity}`);
  if (remaining !== null) parts.push(`ctx ${remaining}%`);
  if (project) parts.push(project);
  if (branch) parts.push(branch);
  if (duration) parts.push(duration);
  return parts.length > 0 ? parts.join(STATUS_SEPARATOR) : "Dove";
}
