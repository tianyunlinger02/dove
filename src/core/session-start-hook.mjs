import fs from "node:fs";

import { openRootedFilesystem } from "./rooted-filesystem.mjs";
import { inspectLatestReviewFacts } from "./review-runtime.mjs";
import { inspectLatestRunFacts } from "./run-record.mjs";

export function parseSessionStartPayload(input) {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    throw new Error("Dove SessionStart hook received malformed JSON.");
  }
  if (payload?.hook_event_name !== "SessionStart") {
    throw new Error("Dove SessionStart hook received an unsupported or missing hook event.");
  }
  return payload;
}

function safePathLabel(item) {
  const path = String(item?.path ?? "unknown").replace(/[\x00-\x1f\x7f-\x9f]/gu, "?");
  const selector = item?.selector === null || item?.selector === undefined
    ? ""
    : String(item.selector).replace(/[\x00-\x1f\x7f-\x9f]/gu, "?");
  return selector ? `${path}#${selector}` : path;
}

function systemMessage(message) {
  return { systemMessage: message };
}

function availableFact(read) {
  try {
    return read() ?? "unavailable";
  } catch {
    return "unavailable";
  }
}

function absoluteTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value ? value : "unavailable";
}

function sessionFacts(project, options = {}) {
  if (typeof project !== "string" || !project.trim()) throw new Error("Dove SessionStart facts require an explicit project root.");
  const fsOps = options.fsOps ?? fs;
  const research = availableFact(() => {
    const stat = openRootedFilesystem(project, { fsOps }).tryLstat(".dove/research/RESEARCH.md");
    if (!stat) return "exists=no; mtime=unavailable";
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    return `exists=yes; mtime=${stat.mtime.toISOString()}`;
  });
  const review = availableFact(() => {
    const latest = inspectLatestReviewFacts({ project, fsOps });
    if (!latest) return null;
    return `id=${latest.reviewId}; round=${latest.round}; updatedAt=${latest.updatedAt}; material currentness=${latest.materialCurrentness}`;
  });
  const run = availableFact(() => {
    const latest = inspectLatestRunFacts({ project, fsOps });
    if (!latest) return null;
    const status = ["starting", "running", "orphaned", "unreconciled", "succeeded", "failed", "timed-out", "signaled", "launch-failed", "interrupted", "terminal"].includes(latest.status)
      ? latest.status : "unavailable";
    const exit = Number.isSafeInteger(latest.exitCode) ? latest.exitCode : "unavailable";
    return `id=${latest.runId}; startedAt=${absoluteTimestamp(latest.startedAt)}; status=${status}; exit=${exit}`;
  });
  return [
    "Dove SessionStart facts (read-only). Latest Review (by updatedAt) and Run (by startedAt) are not the current research mainline.",
    `RESEARCH.md: ${research}`,
    `Latest Review: ${review}`,
    `Latest Run: ${run}`
  ].join("\n");
}

export function sessionStartOutput(payload, result = null, options = {}) {
  const output = {};
  const skipped = Array.isArray(result?.skippedLocalEdits) ? result.skippedLocalEdits : [];
  if (skipped.length > 0) {
    const labels = skipped.slice(0, 6).map(safePathLabel);
    const omitted = Math.max(0, skipped.length - labels.length);
    output.systemMessage = `Dove SessionStart synchronized package-managed integration except local edits at ${labels.join(", ")}${omitted > 0 ? ` and ${omitted} more` : ""}. Run dove update to replace those manifest-owned local edits explicitly.`;
  }
  if (payload.source === "compact" || payload.source === "resume") {
    output.hookSpecificOutput = {
      hookEventName: "SessionStart",
      additionalContext: sessionFacts(options.project, options)
    };
  }
  return Object.keys(output).length > 0 ? output : null;
}

export function sessionStartFailureOutput(error) {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.replace(/[\x00-\x1f\x7f-\x9f]/gu, "?");
  return systemMessage(`Dove SessionStart did not synchronize project integration: ${message}`);
}
