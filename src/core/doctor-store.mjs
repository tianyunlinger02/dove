import fs from "node:fs";
import path from "node:path";

import { writeFileSetTransaction } from "./file-set-transaction.mjs";
import { exactTimestamp, inspectProjectStateFile } from "./project-state-file.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import { parseJsonWithoutDuplicateKeys } from "./strict-json.mjs";

const DOCTOR_FIELDS = new Set(["enabled", "issues", "updatedAt"]);
const ISSUE_FIELDS = new Set(["issueId", "category", "severity", "summary", "firstSeenAt", "lastSeenAt", "occurrences", "action", "state", "detectedBy"]);
const ISSUE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const RESOLVED_LIMIT = 20;
const EMPTY_UPDATED_AT = new Date(0).toISOString();

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  return value;
}

function assertFields(value, fields, label) {
  assertPlainObject(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.join(", ")}.`);
}

function text(value, label) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw new Error(`${label} must be non-empty text.`);
  return value.trim();
}

function visibleText(value) {
  return String(value).replace(/\s+/gu, " ").replace(/`/gu, "'").trim();
}

function timestamp(value) {
  return value === undefined ? new Date().toISOString() : exactTimestamp(value, "Doctor timestamp");
}

function validateIssue(value, label = "Doctor issue") {
  assertFields(value, ISSUE_FIELDS, label);
  if (typeof value.issueId !== "string" || !ISSUE_ID.test(value.issueId)) throw new Error(`${label}.issueId must be a safe identifier.`);
  text(value.category, `${label}.category`);
  if (!["info", "warning", "error"].includes(value.severity)) throw new Error(`${label}.severity is unsupported.`);
  text(value.summary, `${label}.summary`);
  exactTimestamp(value.firstSeenAt, `${label}.firstSeenAt`);
  exactTimestamp(value.lastSeenAt, `${label}.lastSeenAt`);
  if (!Number.isInteger(value.occurrences) || value.occurrences < 1) throw new Error(`${label}.occurrences must be a positive integer.`);
  text(value.action, `${label}.action`);
  if (!["open", "resolved"].includes(value.state)) throw new Error(`${label}.state is unsupported.`);
  text(value.detectedBy, `${label}.detectedBy`);
  return value;
}

export function validateDoctorState(value) {
  assertFields(value, DOCTOR_FIELDS, "Doctor state");
  if (typeof value.enabled !== "boolean") throw new Error("Doctor state.enabled must be boolean.");
  if (!Array.isArray(value.issues)) throw new Error("Doctor state.issues must be an array.");
  value.issues.forEach((issue, index) => validateIssue(issue, `Doctor state.issues[${index}]`));
  if (new Set(value.issues.map((issue) => issue.issueId)).size !== value.issues.length) throw new Error("Doctor state issue IDs must be unique.");
  exactTimestamp(value.updatedAt, "Doctor state.updatedAt");
  return value;
}

function defaultState() {
  return { enabled: true, issues: [], updatedAt: EMPTY_UPDATED_AT };
}

function readSnapshot(root, options = {}) {
  const json = inspectProjectStateFile(root, ARTIFACT_PATHS.doctor, options);
  const document = inspectProjectStateFile(root, ARTIFACT_PATHS.doctorDocument, options);
  const state = json.content === null
    ? defaultState()
    : validateDoctorState(parseJsonWithoutDuplicateKeys(json.content, ARTIFACT_PATHS.doctor));
  if (document.content !== null && document.content !== renderDoctorDocument(state)) {
    throw new Error(`${ARTIFACT_PATHS.doctorDocument} was changed outside Dove; Doctor refuses to overwrite it.`);
  }
  return { state, json, document };
}

export function readDoctorState(root, options = {}) {
  return readSnapshot(root, options).state;
}

export function readDoctorDocument(root, options = {}) {
  const snapshot = readSnapshot(root, options);
  return {
    path: ARTIFACT_PATHS.doctorDocument,
    exists: snapshot.document.content !== null,
    markdown: snapshot.document.content
  };
}

function issueOrder(left, right) {
  const severity = { error: 0, warning: 1, info: 2 };
  return severity[left.severity] - severity[right.severity]
    || left.summary.localeCompare(right.summary)
    || left.issueId.localeCompare(right.issueId);
}

export function renderDoctorDocument(state) {
  validateDoctorState(state);
  const open = state.issues.filter((issue) => issue.state === "open").sort(issueOrder);
  const resolved = state.issues
    .filter((issue) => issue.state === "resolved")
    .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt))
    .slice(0, RESOLVED_LIMIT);
  const lines = [
    "# Dove 问题",
    "",
    "此文件记录 Dove 软件和项目集成问题，不判断科研内容是否正确、完整或完成。",
    ""
  ];
  if (!state.enabled) {
    lines.push("Doctor 自动维护当前已关闭；以下内容可能是关闭前保留的记录。", "");
  }
  lines.push("## 当前问题", "");
  if (open.length === 0) lines.push("当前没有已记录的 Dove 问题。");
  else for (const issue of open) {
    lines.push(`- ${visibleText(issue.summary)}`, `  - 建议：\`${visibleText(issue.action)}\``);
  }
  lines.push("", "## 最近解决", "");
  if (resolved.length === 0) lines.push("暂无最近解决事项。");
  else for (const issue of resolved) {
    lines.push(`- ${issue.lastSeenAt.slice(0, 10)}：已解决“${visibleText(issue.summary)}”。`);
  }
  return `${lines.join("\n")}\n`;
}

function sameState(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function writeDoctorState(root, next, snapshot, options = {}) {
  validateDoctorState(next);
  const markdown = renderDoctorDocument(next);
  const jsonContent = `${JSON.stringify(next, null, 2)}\n`;
  const entries = [];
  if (snapshot.json.content !== jsonContent) entries.push({
    root,
    relativePath: ARTIFACT_PATHS.doctor,
    content: jsonContent,
    force: true,
    expectedState: snapshot.json.state,
    label: "Doctor state"
  });
  if (snapshot.document.content !== markdown) entries.push({
    root,
    relativePath: ARTIFACT_PATHS.doctorDocument,
    content: markdown,
    force: true,
    expectedState: snapshot.document.state,
    label: "Doctor document"
  });
  if (entries.length > 0) writeFileSetTransaction(entries, {
    fsOps: options.fsOps,
    transactionBase: ARTIFACT_PATHS.transactionsDir,
    transactionId: options.transactionId
  });
  return next;
}

function commitChanged(root, current, next, snapshot, options) {
  if (sameState(current, next) && snapshot.document.content !== null) return current;
  if (sameState(current, next) && snapshot.json.content === null && snapshot.document.content === null) return current;
  return writeDoctorState(root, next, snapshot, options);
}

export function setDoctorEnabled(root, enabled, options = {}) {
  if (typeof enabled !== "boolean") throw new Error("Doctor enabled state must be boolean.");
  const snapshot = readSnapshot(root, options);
  if (snapshot.state.enabled === enabled) return commitChanged(root, snapshot.state, snapshot.state, snapshot, options);
  const next = { ...snapshot.state, enabled, updatedAt: timestamp(options.now) };
  return writeDoctorState(root, next, snapshot, options);
}

function normalizedIssue(issue, seenAt, previous = null) {
  const issueId = text(issue.issueId, "Doctor issueId");
  if (!ISSUE_ID.test(issueId)) throw new Error("Doctor issueId must be a safe identifier.");
  const next = {
    issueId,
    category: text(issue.category, "Doctor issue category"),
    severity: issue.severity,
    summary: text(issue.summary, "Doctor issue summary"),
    firstSeenAt: previous?.firstSeenAt ?? seenAt,
    lastSeenAt: previous?.lastSeenAt ?? seenAt,
    occurrences: previous?.occurrences ?? 1,
    action: text(issue.action, "Doctor issue action"),
    state: "open",
    detectedBy: text(issue.detectedBy, "Doctor issue detectedBy")
  };
  validateIssue(next);
  return next;
}

function visibleIssueSame(left, right) {
  return left?.state === "open"
    && left.category === right.category
    && left.severity === right.severity
    && left.summary === right.summary
    && left.action === right.action
    && left.detectedBy === right.detectedBy;
}

export function recordDoctorIssue(root, issue, options = {}) {
  const snapshot = readSnapshot(root, options);
  const current = snapshot.state;
  if (!current.enabled && options.manual !== true) return current;
  const seenAt = timestamp(options.now);
  const previous = current.issues.find((entry) => entry.issueId === issue.issueId) ?? null;
  const candidate = normalizedIssue(issue, seenAt, previous);
  if (visibleIssueSame(previous, candidate)) return commitChanged(root, current, current, snapshot, options);
  const nextIssue = { ...candidate, lastSeenAt: seenAt, occurrences: previous ? Math.min(previous.occurrences + 1, 9999) : 1 };
  const next = {
    enabled: current.enabled,
    issues: retainedIssues([...current.issues.filter((entry) => entry.issueId !== nextIssue.issueId), nextIssue]),
    updatedAt: seenAt
  };
  return writeDoctorState(root, next, snapshot, options);
}

function retainedIssues(issues) {
  const open = issues.filter((issue) => issue.state === "open");
  const resolved = issues
    .filter((issue) => issue.state === "resolved")
    .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt))
    .slice(0, RESOLVED_LIMIT);
  return [...open, ...resolved];
}

export function resolveDoctorIssues(root, openIssueIds, options = {}) {
  const snapshot = readSnapshot(root, options);
  const current = snapshot.state;
  if (!current.enabled && options.manual !== true) return current;
  const open = new Set(openIssueIds);
  const changed = current.issues.some((issue) => issue.state === "open" && !open.has(issue.issueId));
  if (!changed) return commitChanged(root, current, current, snapshot, options);
  const resolvedAt = timestamp(options.now);
  const issues = current.issues.map((issue) => issue.state === "open" && !open.has(issue.issueId) ? { ...issue, state: "resolved", lastSeenAt: resolvedAt } : issue);
  return writeDoctorState(root, { enabled: current.enabled, issues: retainedIssues(issues), updatedAt: resolvedAt }, snapshot, options);
}

export function reconcileDoctorIssues(root, detectedIssues, options = {}) {
  const snapshot = readSnapshot(root, options);
  const current = snapshot.state;
  if (!current.enabled && options.manual !== true) return current;
  const scope = options.detectedBy === undefined ? null : text(options.detectedBy, "Doctor reconcile detectedBy");
  const previousById = new Map(current.issues.map((issue) => [issue.issueId, issue]));
  const seenAt = timestamp(options.now);
  const detected = detectedIssues.map((issue) => normalizedIssue(issue, seenAt, previousById.get(issue.issueId) ?? null));
  const detectedById = new Map(detected.map((issue) => [issue.issueId, issue]));
  let changed = false;
  const reconciled = current.issues
    .filter((issue) => !detectedById.has(issue.issueId))
    .map((issue) => {
      if (issue.state === "open" && (scope === null || issue.detectedBy === scope)) {
        changed = true;
        return { ...issue, state: "resolved", lastSeenAt: seenAt };
      }
      return issue;
    });
  for (const issue of detected) {
    const previous = previousById.get(issue.issueId);
    if (visibleIssueSame(previous, issue)) reconciled.push(previous);
    else {
      changed = true;
      reconciled.push({ ...issue, lastSeenAt: seenAt, occurrences: previous ? Math.min(previous.occurrences + 1, 9999) : 1 });
    }
  }
  if (!changed) return commitChanged(root, current, current, snapshot, options);
  return writeDoctorState(root, { enabled: current.enabled, issues: retainedIssues(reconciled), updatedAt: seenAt }, snapshot, options);
}

export function recordDoctorIssueBestEffort(root, issue, options = {}) {
  try {
    if (!fs.existsSync(path.join(root, ARTIFACT_PATHS.installDir))) return false;
    recordDoctorIssue(root, issue, options);
    return true;
  } catch {
    return false;
  }
}

export function reconcileDoctorIssuesBestEffort(root, issues, options = {}) {
  try {
    if (!fs.existsSync(path.join(root, ARTIFACT_PATHS.installDir))) return false;
    reconcileDoctorIssues(root, issues, options);
    return true;
  } catch {
    return false;
  }
}
