import { ARTIFACT_PATHS } from "./schema.mjs";
import { evaluateEvidence } from "./evidence.mjs";
import { refreshDurableSurfaces } from "./navigation.mjs";
import { loadBoard, normalizeRebuttalIssues, upsertOrchestrationBoard } from "./orchestration.mjs";
import { appendText, listDraftFiles, loadState, nowIso, readJson, saveState, writeJson, writeText } from "./workspace.mjs";

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function renderReviewEntry(entry) {
  return [
    `## ${entry.timestamp} — ${entry.stage}`,
    "",
    `- Scope: ${entry.scope}`,
    `- Verdict: ${entry.verdict}`,
    `- Summary: ${entry.summary}`,
    `- Review required before finalize: ${entry.reviewRequiredBeforeFinalize}`,
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

function normalizeConcern(concern = {}, index = 0) {
  return {
    id: slugify(concern.id ?? concern.summary ?? `concern-${index + 1}`),
    summary: concern.summary ?? `Concern ${index + 1}`,
    severity: concern.severity ?? "medium",
    status: concern.status ?? "open",
    reviewerRationale: concern.reviewerRationale ?? concern.summary ?? "",
    authorRebuttalSummary: concern.authorRebuttalSummary ?? "",
    rulingOutcome: concern.rulingOutcome ?? "pending",
    linkedArtifactPaths: Array.isArray(concern.linkedArtifactPaths) ? concern.linkedArtifactPaths : [],
    claimIds: Array.isArray(concern.claimIds) ? concern.claimIds : [],
    experimentIds: Array.isArray(concern.experimentIds) ? concern.experimentIds : [],
    updatedAt: nowIso()
  };
}

function upsertConcernLedger(root, concerns = [], context = {}) {
  const current = readJson(root, ARTIFACT_PATHS.reviewConcerns, { version: 1, items: [], updatedAt: null });
  const merged = new Map((current.items ?? []).map((item, index) => {
    const normalized = normalizeConcern(item, index);
    return [normalized.id, normalized];
  }));
  const touched = [];

  for (const concern of concerns.map(normalizeConcern)) {
    const existing = merged.get(concern.id);
    const next = {
      ...(existing ?? {}),
      ...concern,
      status: concern.status ?? existing?.status ?? "open",
      updatedAt: nowIso()
    };
    merged.set(next.id, next);
    touched.push(next);
  }

  const items = Array.from(merged.values()).sort((left, right) => left.id.localeCompare(right.id));
  writeJson(root, ARTIFACT_PATHS.reviewConcerns, { version: 1, items, updatedAt: nowIso() });

  const unresolvedConcernIds = items.filter((item) => ["open", "contested"].includes(item.status)).map((item) => item.id);
  const adversarialState = readJson(root, ARTIFACT_PATHS.adversarialReviewState, { version: 1, round: 0, unresolvedConcernIds: [], lastAuditIds: [], lastBridgeIds: [], updatedAt: null });
  writeJson(root, ARTIFACT_PATHS.adversarialReviewState, {
    ...adversarialState,
    round: (adversarialState.round ?? 0) + 1,
    unresolvedConcernIds,
    lastAuditIds: Array.isArray(context.auditIds) ? context.auditIds : adversarialState.lastAuditIds,
    lastBridgeIds: Array.isArray(context.bridgeIds) ? context.bridgeIds : adversarialState.lastBridgeIds,
    updatedAt: nowIso()
  });

  if (touched.length > 0) {
    appendText(root, ARTIFACT_PATHS.reviewDebateLog, `\n## ${nowIso()} — review round\n\n${touched.map((concern) => `- ${concern.id} [${concern.status}]: ${concern.summary}`).join("\n")}\n`);
  }
  return { items, unresolvedConcernIds };
}

export function appendReviewLog(root, args = {}) {
  const timestamp = args.timestamp ?? nowIso();
  const entry = {
    timestamp,
    stage: args.stage ?? "manual-review",
    scope: args.scope ?? "current paper materials",
    verdict: args.verdict ?? "needs-work",
    summary: args.summary ?? "No summary provided.",
    reviewRequiredBeforeFinalize: Boolean(args.reviewRequiredBeforeFinalize ?? true),
    findings: Array.isArray(args.findings)
      ? args.findings.map((item) => ({ severity: item.severity ?? "medium", summary: item.summary ?? String(item), claimIds: item.claimIds ?? [], experimentIds: item.experimentIds ?? [] }))
      : [],
    actionItems: Array.isArray(args.actionItems) ? args.actionItems : []
  };

  appendText(root, ARTIFACT_PATHS.reviewLog, `\n${renderReviewEntry(entry)}`);
  const reviewState = readJson(root, ARTIFACT_PATHS.reviewState, { version: 2, history: [], openItems: [], lastVerdict: "not-reviewed", lastReviewedAt: null, unresolvedConcernIds: [] });
  const concernLedger = upsertConcernLedger(root, entry.findings.map((finding, index) => ({
    id: `review-${entry.stage}-${index + 1}`,
    summary: finding.summary,
    severity: finding.severity,
    status: entry.verdict === "coherent" ? "resolved" : "open",
    reviewerRationale: finding.summary,
    linkedArtifactPaths: [ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.revisionPlan],
    claimIds: finding.claimIds,
    experimentIds: finding.experimentIds
  })));
  const nextReviewState = {
    ...reviewState,
    version: 2,
    lastVerdict: entry.verdict,
    lastReviewedAt: timestamp,
    history: [...reviewState.history, entry],
    openItems: entry.actionItems,
    unresolvedConcernIds: concernLedger.unresolvedConcernIds
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
      openItems: entry.actionItems,
      unresolvedConcernIds: concernLedger.unresolvedConcernIds
    }
  });
  upsertOrchestrationBoard(root, {
    phase: "review",
    assignedRole: "reviewer",
    intentType: entry.verdict === "coherent" ? "review" : "repair",
    currentFocus: entry.summary,
    nextAction: entry.verdict === "coherent"
      ? "Refresh downstream artifacts before finalization claims."
      : "Turn the highest-severity review findings into concrete revision work.",
    reviewRequiredBeforeFinalize: entry.reviewRequiredBeforeFinalize,
    blockers: entry.actionItems.map((item, index) => ({
      id: `review-blocker-${index + 1}`,
      summary: item,
      status: entry.verdict === "coherent" ? "resolved" : "open",
      assignedRole: "reviewer",
      currentFocus: item,
      nextAction: "Resolve the review blocker and re-run review."
    })),
    continuationState: {
      status: entry.verdict === "coherent" ? "ready-to-resume" : "blocked",
      lastCheckpoint: `Review verdict recorded: ${entry.verdict}.`,
      checkpointHistory: [{ summary: `Review verdict recorded: ${entry.verdict}.`, recordedAt: timestamp }]
    }
  });
  refreshDurableSurfaces(root, {
    type: "append-review-log",
    summary: `Recorded review verdict ${entry.verdict}.`,
    artifactPaths: [ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.reviewState, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.adversarialReviewState, ARTIFACT_PATHS.revisionPlan]
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
    intentType: "repair",
    currentFocus: summary,
    nextAction: items[0] ?? "Refresh the review loop once revisions land.",
    tasks: items.map((item, index) => ({
      id: `revision-task-${index + 1}`,
      title: item,
      status: "pending",
      assignedRole: "planner",
      currentFocus: item,
      nextAction: "Complete the revision and refresh review surfaces."
    })),
    blockers: items.map((item, index) => ({
      id: `revision-blocker-${index + 1}`,
      summary: item,
      status: "open",
      assignedRole: "planner",
      currentFocus: item,
      nextAction: "Resolve the revision blocker before finalization."
    })),
    reviewRequiredBeforeFinalize: true
  });
  refreshDurableSurfaces(root, {
    type: "upsert-revision-plan",
    summary: `Updated revision plan with ${items.length} items.`,
    artifactPaths: [ARTIFACT_PATHS.revisionPlan, ARTIFACT_PATHS.taskPacketsIndex, ARTIFACT_PATHS.sessionSummary]
  });
  return { updatedAt: timestamp, itemCount: items.length };
}

export function runReviewLoop(root, args = {}) {
  const state = loadState(root);
  const board = loadBoard(root);
  const evidence = evaluateEvidence(root);
  const auditIndex = readJson(root, ARTIFACT_PATHS.experimentAudits, { version: 1, items: [], updatedAt: null });
  const bridgeLog = readJson(root, ARTIFACT_PATHS.claimBridgeLog, { version: 1, items: [], updatedAt: null });
  const findings = [];

  for (const claim of evidence.unsupportedClaims) {
    findings.push({ severity: "high", summary: `Claim ${claim.id} has no source support.`, claimIds: [claim.id] });
  }

  for (const claim of evidence.weakClaims) {
    findings.push({ severity: "medium", summary: `Claim ${claim.id} is weakly supported and should be strengthened.`, claimIds: [claim.id] });
  }

  for (const item of evidence.missingSourceRefs) {
    findings.push({ severity: "high", summary: `Claim ${item.claim.id} references missing sources: ${item.missing.join(", ")}.`, claimIds: [item.claim.id] });
  }

  for (const item of evidence.missingNoteRefs) {
    findings.push({ severity: "medium", summary: `Claim ${item.claim.id} references missing notes: ${item.missing.join(", ")}.`, claimIds: [item.claim.id] });
  }

  for (const item of evidence.missingCitationRefs) {
    findings.push({ severity: "high", summary: `${item.draftFile} cites unknown source key ${item.key}.` });
  }

  const experimentResults = readJson(root, ARTIFACT_PATHS.experimentResults, { version: 1, items: [], updatedAt: null });
  for (const result of experimentResults.items) {
    if (result.outcome === "failed" || result.outcome === "refutes") {
      findings.push({ severity: "high", summary: `Experiment ${result.experimentId} returned ${result.outcome} and needs claim/rebuttal follow-up.`, experimentIds: [result.experimentId], claimIds: result.claimId ? [result.claimId] : [] });
    }
    if (result.outcome === "inconclusive") {
      findings.push({ severity: "medium", summary: `Experiment ${result.experimentId} is inconclusive and weakens claim confidence.`, experimentIds: [result.experimentId], claimIds: result.claimId ? [result.claimId] : [] });
    }
  }

  for (const audit of evidence.auditIntegrityFlags) {
    findings.push({ severity: "high", summary: `Experiment audit ${audit.id} raised integrity flags: ${audit.integrityFlags.join(", ")}.`, experimentIds: audit.experimentId ? [audit.experimentId] : [], claimIds: audit.claimId ? [audit.claimId] : [] });
  }

  for (const bridgeProblem of evidence.claimBridgeProblems) {
    findings.push({ severity: "high", summary: `Claim ${bridgeProblem.claim.id} has a result-to-claim bridge problem (${bridgeProblem.reason}).`, claimIds: [bridgeProblem.claim.id] });
  }

  for (const item of evidence.draftClaimMismatches) {
    if (item.reason === "missing-draft") {
      findings.push({ severity: "medium", summary: `Claim ${item.claim.id} targets section ${item.claim.sectionId} but no draft exists for that section.`, claimIds: [item.claim.id] });
      continue;
    }
    findings.push({ severity: "medium", summary: `Draft for ${item.claim.sectionId} does not cite any expected source for claim ${item.claim.id}.`, claimIds: [item.claim.id] });
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
    actionItems,
    reviewRequiredBeforeFinalize: true
  });

  normalizeRebuttalIssues(root, {
    issues: findings.map((finding, index) => ({
      id: `review-issue-${index + 1}`,
      reviewer: args.reviewer ?? "review-loop",
      summary: finding.summary,
      severity: finding.severity,
      status: verdict === "coherent" ? "resolved" : "open",
      evidenceLinks: board.evidenceLinks,
      claimIds: finding.claimIds,
      experimentIds: finding.experimentIds,
      responseDirection: finding.severity === "high" ? "fix" : "clarify"
    }))
  });

  const latestAuditIds = (auditIndex.items ?? []).slice(-5).map((item) => item.id);
  const latestBridgeIds = (bridgeLog.items ?? []).slice(-5).map((item) => item.id);
  upsertConcernLedger(root, [], { auditIds: latestAuditIds, bridgeIds: latestBridgeIds });

  return entry;
}
