import { ARTIFACT_PATHS } from "./schema.mjs";
import { evaluateEvidence } from "./evidence.mjs";
import { loadBoard, normalizeRebuttalIssues, upsertOrchestrationBoard } from "./orchestration.mjs";
import { loadState, nowIso, readJson, appendText, saveState, writeJson, writeText, listDraftFiles } from "./workspace.mjs";

function renderReviewEntry(entry) {
  return [
    `## ${entry.timestamp} — ${entry.stage}`,
    "",
    `- Scope: ${entry.scope}`,
    `- Verdict: ${entry.verdict}`,
    `- Summary: ${entry.summary}`,
    "- Findings:",
    ...(entry.findings.length > 0 ? entry.findings.map((item) => `  - [${item.severity}] ${item.summary}`) : ["  - None recorded"]),
    "- Action items:",
    ...(entry.actionItems.length > 0 ? entry.actionItems.map((item) => `  - ${item}`) : ["  - None recorded"]),
    ""
  ].join("\n");
}

function renderRevisionPlan(review) {
  return [
    "# Current revision plan",
    "",
    `- Verdict: ${review.verdict}`,
    `- Updated: ${review.timestamp}`,
    "",
    "## Action items",
    "",
    ...(review.actionItems.length > 0 ? review.actionItems.map((item) => `- [ ] ${item}`) : ["- [ ] No action items recorded."])
  ].join("\n");
}

export function appendReviewLog(root, args = {}) {
  const timestamp = args.timestamp ?? nowIso();
  const entry = {
    timestamp,
    stage: args.stage ?? "manual-review",
    scope: args.scope ?? "current paper materials",
    verdict: args.verdict ?? "needs-work",
    summary: args.summary ?? "No summary provided.",
    findings: Array.isArray(args.findings)
      ? args.findings.map((item) => ({ severity: item.severity ?? "medium", summary: item.summary ?? String(item) }))
      : [],
    actionItems: Array.isArray(args.actionItems) ? args.actionItems : []
  };

  appendText(root, ARTIFACT_PATHS.reviewLog, `\n${renderReviewEntry(entry)}`);
  const reviewState = readJson(root, ARTIFACT_PATHS.reviewState, { version: 1, history: [], openItems: [], lastVerdict: "not-reviewed", lastReviewedAt: null });
  const nextReviewState = {
    ...reviewState,
    lastVerdict: entry.verdict,
    lastReviewedAt: timestamp,
    history: [...reviewState.history, entry],
    openItems: entry.actionItems
  };
  writeJson(root, ARTIFACT_PATHS.reviewState, nextReviewState);
  writeText(root, ARTIFACT_PATHS.revisionPlan, renderRevisionPlan(entry));
  const state = loadState(root);
  saveState(root, {
    ...state,
    pipeline: {
      ...state.pipeline,
      currentStage: "review",
      lastCompletedStage: "review",
      resumeCommand: "project:paper.revise",
      updatedAt: timestamp
    },
    reviews: {
      lastVerdict: entry.verdict,
      lastReviewedAt: timestamp,
      openItems: entry.actionItems
    }
  });
  upsertOrchestrationBoard(root, {
    phase: "review",
    assignedRole: "reviewer",
    blockers: entry.actionItems.map((item, index) => ({
      id: `review-blocker-${index + 1}`,
      summary: item,
      status: entry.verdict === "coherent" ? "resolved" : "open",
      assignedRole: "reviewer"
    }))
  });
  return entry;
}

export function upsertRevisionPlan(root, args = {}) {
  const timestamp = args.updatedAt ?? nowIso();
  const summary = args.summary ?? "Manual revision plan update.";
  const items = Array.isArray(args.items) ? args.items : [];
  const content = [
    "# Current revision plan",
    "",
    `- Updated: ${timestamp}`,
    `- Summary: ${summary}`,
    "",
    "## Action items",
    "",
    ...(items.length > 0 ? items.map((item) => `- [ ] ${item}`) : ["- [ ] No action items recorded."])
  ].join("\n");
  writeText(root, ARTIFACT_PATHS.revisionPlan, content);
  upsertOrchestrationBoard(root, {
    phase: "review",
    assignedRole: "planner",
    tasks: items.map((item, index) => ({
      id: `revision-task-${index + 1}`,
      title: item,
      status: "pending",
      assignedRole: "planner"
    })),
    blockers: items.map((item, index) => ({
      id: `revision-blocker-${index + 1}`,
      summary: item,
      status: "open",
      assignedRole: "planner"
    }))
  });
  return { updatedAt: timestamp, itemCount: items.length };
}

export function runReviewLoop(root, args = {}) {
  const state = loadState(root);
  const board = loadBoard(root);
  const evidence = evaluateEvidence(root);
  const findings = [];

  for (const claim of evidence.unsupportedClaims) {
    findings.push({ severity: "high", summary: `Claim ${claim.id} has no source support.` });
  }

  for (const claim of evidence.weakClaims) {
    findings.push({ severity: "medium", summary: `Claim ${claim.id} is weakly supported and should be strengthened.` });
  }

  for (const item of evidence.missingSourceRefs) {
    findings.push({ severity: "high", summary: `Claim ${item.claim.id} references missing sources: ${item.missing.join(", ")}.` });
  }

  for (const item of evidence.missingNoteRefs) {
    findings.push({ severity: "medium", summary: `Claim ${item.claim.id} references missing notes: ${item.missing.join(", ")}.` });
  }

  for (const item of evidence.missingCitationRefs) {
    findings.push({ severity: "high", summary: `${item.draftFile} cites unknown source key ${item.key}.` });
  }

  const experimentResults = readJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null });
  for (const result of experimentResults.items) {
    if (result.outcome === "failed" || result.outcome === "refutes") {
      findings.push({ severity: "high", summary: `Experiment ${result.experimentId} returned ${result.outcome} and needs claim/rebuttal follow-up.` });
    }
    if (result.outcome === "inconclusive") {
      findings.push({ severity: "medium", summary: `Experiment ${result.experimentId} is inconclusive and weakens claim confidence.` });
    }
  }

  for (const item of evidence.draftClaimMismatches) {
    if (item.reason === "missing-draft") {
      findings.push({ severity: "medium", summary: `Claim ${item.claim.id} targets section ${item.claim.sectionId} but no draft exists for that section.` });
      continue;
    }
    findings.push({ severity: "medium", summary: `Draft for ${item.claim.sectionId} does not cite any expected source for claim ${item.claim.id}.` });
  }

  for (const todo of evidence.citationTodos) {
    findings.push({ severity: "medium", summary: `${todo.draftFile}:${todo.line} still has a citation TODO.` });
  }

  const draftedSections = new Set(listDraftFiles(root).map((fileName) => fileName.replace(/\.md$/, "")));
  for (const section of Object.values(state.sections)) {
    if (section.status !== "planned" && !draftedSections.has(section.id)) {
      findings.push({ severity: "medium", summary: `Section ${section.title} is marked ${section.status} but has no draft file.` });
    }
  }

  const actionItems = findings.map((finding) => finding.summary);
  const verdict = findings.some((finding) => finding.severity === "high")
    ? "needs-evidence"
    : findings.length > 0
      ? "needs-revision"
      : "coherent";

  const entry = appendReviewLog(root, {
    stage: args.stage ?? "review-loop",
    scope: args.scope ?? "current paper pipeline",
    verdict,
    summary: verdict === "coherent"
      ? "The current paper artifacts are internally consistent."
      : "The current paper artifacts need another revision pass.",
    findings,
    actionItems
  });

  normalizeRebuttalIssues(root, {
    issues: findings.map((finding, index) => ({
      id: `review-issue-${index + 1}`,
      reviewer: args.reviewer ?? "review-loop",
      summary: finding.summary,
      severity: finding.severity,
      status: verdict === "coherent" ? "resolved" : "open",
      evidenceLinks: board.evidenceLinks,
      responseDirection: finding.severity === "high" ? "fix" : "clarify"
    }))
  });

  return entry;
}
