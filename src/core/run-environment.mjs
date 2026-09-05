import { spawnSync } from "node:child_process";

const GIT_CAPTURE_TIMEOUT_MS = 5000;
const GIT_CAPTURE_MAX_BUFFER = 1024 * 1024;

function runGit(projectRoot, gitArgs, options = {}) {
  const gitCommand = options.gitCommand ?? "git";
  try {
    const result = spawnSync(gitCommand, ["-C", projectRoot, ...gitArgs], {
      cwd: projectRoot,
      shell: false,
      encoding: null,
      timeout: options.gitTimeoutMs ?? GIT_CAPTURE_TIMEOUT_MS,
      maxBuffer: options.gitMaxBuffer ?? GIT_CAPTURE_MAX_BUFFER,
      windowsHide: true
    });
    if (result.error || result.signal) return { ok: false };
    return {
      ok: true,
      statusCode: result.status ?? 0,
      stdout: Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout ?? "")
    };
  } catch {
    return { ok: false };
  }
}

function trimGitOutput(bytes) {
  return bytes.toString("utf8").trim();
}

function normalizeCommit(value) {
  if (value === undefined || value === null || value === "") return null;
  const trimmed = String(value).trim().toLowerCase();
  return /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(trimmed) ? trimmed : null;
}

function normalizeDirty(value) {
  if (value === true || value === false) return value;
  return null;
}

export function normalizeRunGitFacts(value = {}) {
  return {
    commit: normalizeCommit(value.commit ?? null),
    dirty: normalizeDirty(value.dirty)
  };
}

export function captureRunGitFacts(projectRoot, options = {}) {
  try {
    if (typeof projectRoot !== "string" || !projectRoot.trim() || projectRoot.includes("\0")) return { commit: null, dirty: null };
    const inside = runGit(projectRoot, ["rev-parse", "--is-inside-work-tree"], options);
    if (!inside.ok || inside.statusCode !== 0 || trimGitOutput(inside.stdout) !== "true") return { commit: null, dirty: null };

    const headResult = runGit(projectRoot, ["rev-parse", "--verify", "HEAD"], options);
    const commit = headResult.ok && headResult.statusCode === 0 ? normalizeCommit(trimGitOutput(headResult.stdout)) : null;

    const statusResult = runGit(projectRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], options);
    const dirty = statusResult.ok && statusResult.statusCode === 0 ? statusResult.stdout.length > 0 : null;
    return { commit, dirty };
  } catch {
    return { commit: null, dirty: null };
  }
}
