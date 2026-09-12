import { spawnSync } from "node:child_process";
import crypto from "node:crypto";

export const DOVE_REVIEW_BACKEND_ID = "claude-code";

const BASE_CLAUDE_ARGS = Object.freeze([
  "--safe-mode",
  "--setting-sources", "local",
  "--strict-mcp-config",
  "--disable-slash-commands",
  "--tools", "Read",
  "--permission-mode", "dontAsk",
  "--input-format", "text",
  "--print",
  "--output-format", "json"
]);

function exactIsoTimestamp(value = new Date()) {
  const timestamp = value instanceof Date ? value.toISOString() : value;
  if (typeof timestamp !== "string" || new Date(timestamp).toISOString() !== timestamp) throw new Error("Dove review backend timestamp must be an exact ISO timestamp.");
  return timestamp;
}

function commandFromOptions(options = {}) {
  const command = options.claudeCommand ?? options.env?.DOVE_CLAUDE_COMMAND ?? process.env.DOVE_CLAUDE_COMMAND ?? "claude";
  if (typeof command !== "string" || !command.trim() || command.includes("\0")) throw new Error("Dove review Claude command must be a non-empty executable name or path.");
  return command;
}

function parseClaudeJson(stdout) {
  const text = String(stdout ?? "").trim();
  if (!text) throw new Error("Claude Code returned no JSON output.");
  const value = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Claude Code JSON output must be an object.");
  return value;
}

function reportFromPayload(payload) {
  for (const field of ["result", "response", "text", "content"]) {
    if (typeof payload[field] === "string" && payload[field].trim()) return payload[field];
  }
  throw new Error("Claude Code JSON output did not contain a Markdown review result.");
}

function validateSessionId(payload, expectedSessionId) {
  if (typeof payload.session_id !== "string" || !payload.session_id.trim()) throw new Error("Claude Code JSON output did not include a session_id.");
  if (payload.session_id !== expectedSessionId) throw new Error("Claude Code returned a session_id that does not match the requested reviewer session.");
  return payload.session_id;
}

function normalizeSessionId(value, label) {
  if (value !== undefined && (typeof value !== "string" || !value.trim() || value.includes("\0"))) throw new Error(`${label} must be a non-empty session id string.`);
  return value;
}

function claudeArgs(session) {
  if (session?.resumeSessionId) return { args: [...BASE_CLAUDE_ARGS, "--resume", normalizeSessionId(session.resumeSessionId, "Dove review resume session id")], requestedSessionId: session.resumeSessionId, resumed: true };
  const sessionId = normalizeSessionId(session?.sessionId, "Dove review session id") ?? crypto.randomUUID();
  return { args: [...BASE_CLAUDE_ARGS, "--session-id", sessionId], requestedSessionId: sessionId, resumed: false };
}

export function runClaudeReviewBackend(options = {}) {
  const command = commandFromOptions(options);
  const { args, requestedSessionId, resumed } = claudeArgs(options.session ?? {});
  const startedAt = exactIsoTimestamp(options.now ?? new Date());
  const spawnOptions = {
    cwd: options.workspaceRoot,
    input: options.prompt,
    encoding: "utf8",
    maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
    env: options.env ?? process.env,
    timeout: options.timeout ?? 10 * 60 * 1000
  };
  const spawned = (options.spawnSync ?? spawnSync)(command, args, spawnOptions);
  const completedAt = exactIsoTimestamp(new Date());
  const baseRecord = {
    schema: "dove.review.backend.v1",
    backend: DOVE_REVIEW_BACKEND_ID,
    command,
    argv: args,
    cwd: options.workspaceRoot,
    startedAt,
    completedAt,
    requestedSessionId,
    resumed,
    exitStatus: spawned.status ?? null,
    signal: spawned.signal ?? null
  };

  if (spawned.error) {
    const message = spawned.error instanceof Error ? spawned.error.message : String(spawned.error);
    return { status: "failed", report: null, sessionId: null, backend: { ...baseRecord, status: "failed", error: message } };
  }
  if (spawned.status !== 0) {
    const stderr = String(spawned.stderr ?? "").trim();
    return { status: "failed", report: null, sessionId: null, backend: { ...baseRecord, status: "failed", error: stderr || `Claude Code exited with status ${spawned.status}.` } };
  }

  try {
    const payload = parseClaudeJson(spawned.stdout);
    if (payload.is_error === true) throw new Error(typeof payload.result === "string" ? payload.result : "Claude Code returned a reviewer session error.");
    const sessionId = validateSessionId(payload, requestedSessionId);
    const report = reportFromPayload(payload);
    return {
      status: "completed",
      report,
      sessionId,
      backend: {
        ...baseRecord,
        status: "completed",
        sessionId
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "failed", report: null, sessionId: null, backend: { ...baseRecord, status: "failed", error: message } };
  }
}
