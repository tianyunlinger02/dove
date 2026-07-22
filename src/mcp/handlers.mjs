import { assessMissionCompletion } from "../core/completion-gates.mjs";
import { toolInteractionFor } from "../core/command-manifest.mjs";
import { queryDoveMission, queryDoveStatus } from "../core/mission-queries.mjs";
import { closeHostOutcome, ingestExecutionReceipt, resolveExecutionReceiptPostCommit } from "../core/execution-receipts.mjs";
import { normalizeHostWorkspaceArtifactPath, normalizeHostWorkspaceFilePath, normalizeHostWorkspacePath } from "../core/host-path-normalizer.mjs";
import { queryDoveLessons, recordDoveLesson } from "../core/lessons.mjs";
import { createDoveMission, initDoveGoal } from "../core/mission-contracts.mjs";
import { queryNetworkSearchProviders, searchNetwork } from "../core/network-search.mjs";
import {
  buildRebuttal,
  buildRebuttalStrategy,
  compareVersions,
  createVersionSnapshot,
  normalizeRebuttalIssues,
  runExperienceWorkflow,
  runFigureWorkflow,
  upsertClaims,
  upsertDraft,
  upsertDraftMetadata,
  upsertNote
} from "../core/retained-domain-workflows.mjs";
import { querySources, registerSource, verifySource } from "../core/source-trust.mjs";
import {
  importReviewExchange,
  prepareReviewExchange,
  previewReviewExchangePreparation,
  verifyReviewCoverage
} from "../core/review-exchange.mjs";
import { currentMutationContext, runWithMutationContext } from "../core/mutation-backend.mjs";
import { MUTATING_TOOL_NAMES, TOOL_INPUT_PROPERTY_NAMES, TOOL_INPUT_SCHEMAS } from "./tool-definitions.mjs";
import { assertMcpInputSchema } from "./schema-validation.mjs";

const CHECKPOINT_TOOL_NAMES = new Set([
  "init_dove_goal",
  "create_dove_mission",
  "prepare_review_exchange"
]);

function textResult(data, isError = false) {
  return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }], ...(isError ? { isError: true } : {}) };
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const PUBLIC_REASON_MESSAGES = {
  "mission-dependency-incomplete": "A required earlier mission is not complete.",
  "mission-superseded": "This mission has been superseded.",
  "explicit-mission-required": "Choose a mission explicitly.",
  "execution-receipt-missing": "No current outcome evidence has been recorded.",
  "execution-receipts-stale-or-invalid": "Recorded outcome evidence is no longer current.",
  "mission-artifact-coverage-missing": "Required mission artifacts are not yet covered by current evidence.",
  "review-evidence-unavailable": "Independent review evidence is unavailable.",
  "source-evidence-unavailable": "Eligible source evidence is unavailable."
};

const PUBLIC_MESSAGES = {
  init_dove_goal: "Dove project records are ready.",
  create_dove_mission: "The mission checkpoint is ready and the host can continue the requested work.",
  query_dove_mission: "The mission preview is ready.",
  ingest_execution_receipt: "The current outcome evidence was recorded.",
  close_host_outcome: "The host-produced outcome evidence was recorded.",
  assess_mission_completion: "Mission completion was assessed.",
  search_network: "The network search finished.",
  query_network_search_providers: "Search provider availability is ready.",
  query_sources: "The source query finished.",
  query_dove_lessons: "The lesson query finished.",
  record_dove_lesson: "The requested lesson was recorded.",
  register_source: "The source candidate was recorded.",
  verify_source: "The source audit result was recorded.",
  upsert_note: "The synthesis note was recorded.",
  upsert_claims: "The evidence-backed claims were recorded.",
  run_experience_workflow: "The experiment material was recorded.",
  upsert_draft: "The draft was recorded.",
  upsert_draft_metadata: "The draft metadata was updated.",
  run_figure_workflow: "The figure material was recorded.",
  prepare_review_exchange: "The independent review package is ready.",
  import_review_exchange: "The returned review was imported.",
  verify_review_coverage: "Review coverage was verified.",
  normalize_rebuttal_issues: "The reviewer issues were normalized.",
  build_rebuttal_strategy: "The rebuttal strategy was recorded.",
  build_rebuttal: "The rebuttal responses were recorded.",
  create_version_snapshot: "The version snapshot was recorded.",
  compare_versions: "The selected versions were compared."
};

function safeText(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/(?:^|[\s"'(])\.dove(?:-archive)?(?:\/[A-Za-z0-9._/-]+)?/gu, " an internal Dove artifact")
    .replace(/\/(?:home|tmp|var|private|Users)\/[A-Za-z0-9._/@+-]+(?:\/[A-Za-z0-9._/@+-]+)*/gu, "the selected path")
    .replace(/\b[0-9a-f]{64}\b/giu, "the validated fingerprint")
    .replace(/\b(?:proposal(?:Digest|Workspace|Version|Token)|confirmArgs|confirm|exactReplay|resultMode|mutationMode|MutationContext|confirmed|(?:workspace|mission|source|note|claim|experiment|figure|review|exchange|version|lesson|receipt|criterion)Ids?|contractDigest|sourceTreeDigest|archiveTarget)\b/gu, "validated internal state")
    .replace(/\b(?:source|note|claim|experiment-result|review|lesson|receipt):[a-z0-9._-]+\b/giu, "the selected evidence")
    .replace(/\bUnknown (?:mission|source|note|claim|experiment|figure|review|exchange|version|lesson|receipt|criterion):\s*[a-z0-9._-]+\b/giu, "The selected item was not found")
    .replace(/\b(?:Mission|Source|Note|Claim|Experiment|Figure|Review|Exchange|Version|Lesson|Receipt|Criterion)\s+[a-z0-9._-]+(?=\s+(?:belongs|does|is|has|requires|cannot|contains|was)\b)/giu, "The selected item")
    .replace(/\b(?:workspace|mission|source|note|claim|experiment|figure|review|exchange|version|lesson|receipt|criterion)-[a-z0-9._-]+\b/giu, "the selected item");
}

function safeReason(value) {
  if (typeof value === "string" && PUBLIC_REASON_MESSAGES[value]) return PUBLIC_REASON_MESSAGES[value];
  const text = safeText(value);
  return typeof text === "string" && /\b(?:schema|contract|receipt|digest|hash|fingerprint|binding|ledger|internal state)\b/iu.test(text)
    ? "Recorded evidence is unavailable or no longer current."
    : text;
}

function safeStrings(value, transform = safeText) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string").map(transform) : [];
}

function publicPath(value) {
  return typeof value === "string" && value.trim() && !/(?:^|\/)\.dove(?:-archive)?(?:\/|$)/u.test(value) ? safeText(value) : null;
}

function publicArtifacts(items) {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    const path = publicPath(typeof item === "string" ? item : item?.path ?? item?.reference);
    if (!path) return [];
    const result = { path };
    if (isPlainObject(item)) {
      for (const field of ["kind", "current", "covered", "status"]) if (item[field] !== undefined) result[field] = item[field];
      if (typeof item.reason === "string") result.reason = safeReason(item.reason);
    }
    return [result];
  });
}

function publicItems(items, fields) {
  if (!Array.isArray(items)) return [];
  return items.filter(isPlainObject).map((item) => Object.fromEntries(fields.flatMap((field) => {
    if (item[field] === undefined) return [];
    if (field === "reason") return [[field, safeReason(item[field])]];
    if (field === "eligibility" && isPlainObject(item[field])) return [[field, { eligible: item[field].eligible === true, reason: safeReason(item[field].reason) }]];
    if (["message", "error", "summary", "details"].includes(field)) return [[field, safeText(item[field])]];
    return [[field, item[field]]];
  })));
}

function publicCompletion(data) {
  if (!isPlainObject(data)) return null;
  return {
    status: data.status,
    complete: data.complete === true,
    gaps: safeStrings(data.incompleteReasons, safeReason),
    artifacts: publicArtifacts(data.artifactCoverage),
    criteria: Array.isArray(data.criterionCoverage) ? data.criterionCoverage.map((item) => ({ description: safeText(item?.criterion), covered: item?.covered === true })) : [],
    requirements: Array.isArray(data.evidenceRequirements) ? data.evidenceRequirements.map((item) => ({ requirement: safeText(item?.requirement), satisfied: item?.satisfied === true, reason: safeReason(item?.reason) })) : []
  };
}

function publicReview(data) {
  if (!isPlainObject(data)) return null;
  return {
    covered: data.covered === true,
    authoritative: data.authoritative === true,
    failures: safeStrings(data.failures, safeReason),
    artifacts: publicArtifacts(data.requestedArtifactPaths),
    reviews: Array.isArray(data.reviews) ? data.reviews.map((item) => ({
      current: item?.current === true,
      authoritative: item?.authoritative === true,
      verdict: item?.verdict,
      failures: safeStrings(item?.failures, safeReason),
      artifacts: publicArtifacts(item?.reviewedArtifactPaths)
    })) : []
  };
}

function safeMessage(name, data) {
  if (name === "query_dove_status") {
    const state = data?.currentContext?.integrityAssessment?.status;
    const count = data?.currentContext?.missionCount;
    if (typeof count === "number") return state ? `Dove has ${count} mission checkpoint${count === 1 ? "" : "s"}; current integrity is ${state}.` : `Dove has ${count} mission checkpoint${count === 1 ? "" : "s"}.`;
  }
  return typeof data?.summary === "string" ? safeText(data.summary) : PUBLIC_MESSAGES[name];
}

export function publicResult(name, data) {
  if (!isPlainObject(data)) return data;
  const result = {};
  for (const field of ["status", "operation", "detailsAvailable", "zeroWrite", "complete", "policy", "inputBoundary"]) {
    if (data[field] !== undefined) result[field] = data[field];
  }
  const message = safeMessage(name, data);
  if (message) result.message = message;
  if (isPlainObject(data.approval)) result.approval = {
    required: data.approval.required === true,
    noChangesApplied: data.approval.noChangesApplied === true,
    summary: safeText(data.approval.summary),
    effects: safeStrings(data.approval.effects),
    question: safeText(data.approval.question)
  };
  const next = data.nextStep ?? data.nextAction;
  if (isPlainObject(next)) result.continuation = {
    label: safeText(next.label),
    why: safeText(next.why),
    requiredActions: safeStrings(next.requiredActions)
  };
  if (name === "query_dove_mission" && isPlainObject(data.mission)) result.mission = {
    goal: safeText(data.mission.goal),
    scope: safeStrings(data.mission.scope),
    outOfScope: safeStrings(data.mission.outOfScope),
    artifacts: publicArtifacts([...(data.mission.targetArtifacts ?? []), ...(data.mission.expectedArtifacts ?? [])]),
    completionCriteria: safeStrings(data.mission.completionCriteria),
    evidenceRequirements: safeStrings(data.mission.evidenceRequirements, safeReason)
  };
  if (name === "query_dove_status" && isPlainObject(data.currentContext)) result.current = {
    missionCount: data.currentContext.missionCount,
    missionScope: data.currentContext.missionScope,
    sourceCount: data.currentContext.sourceCount,
    integrity: data.currentContext.integrityAssessment ? {
      status: data.currentContext.integrityAssessment.status,
      complete: data.currentContext.integrityAssessment.complete,
      gaps: safeStrings(data.currentContext.integrityAssessment.incompleteReasons, safeReason)
    } : null,
    review: publicReview(data.currentContext.reviewValidity),
    researchTree: data.currentContext.researchTree ? { nodeCount: data.currentContext.researchTree.nodeCount, statusCounts: data.currentContext.researchTree.statusCounts } : null
  };
  if (name === "query_dove_status" && isPlainObject(data.needsAttention)) {
    result.attention = { status: data.needsAttention.status, summary: safeText(data.needsAttention.summary), reasons: safeStrings(data.needsAttention.reasons, safeReason) };
    if (isPlainObject(data.needsAttention.stableGaps)) result.gaps = {
      completion: safeStrings(data.needsAttention.stableGaps.completion, safeReason),
      artifacts: publicArtifacts(data.needsAttention.stableGaps.domain),
      review: safeStrings(data.needsAttention.stableGaps.review, safeReason),
      superseded: Boolean(data.needsAttention.stableGaps.supersession)
    };
  }
  if (name === "search_network") result.candidates = publicItems(data.candidates, ["title", "url", "snippet", "sourceName", "publishedAt", "authors", "openAccess"]);
  if (name === "query_sources") result.sources = publicItems(data.items, ["title", "authors", "year", "locator", "sourceType", "abstract", "lifecycle", "eligibility"]);
  if (name === "query_dove_lessons") result.lessons = publicItems(data.items, ["scope", "kind", "summary", "details", "nextTimeGuidance", "tags"]);
  if (["search_network", "query_network_search_providers"].includes(name)) result.providers = publicItems(data.providers ?? data.providerReports, ["displayName", "kind", "access", "status", "resultCount", "fetchedCount", "capabilities", "message", "error"]);
  const completion = publicCompletion(name === "assess_mission_completion" ? data : data.completion?.assessment);
  if (completion) result.completion = completion;
  else if (data.completion?.assessmentUnavailable === true) result.completion = { status: "unavailable", message: "The outcome evidence was recorded, but completion could not be assessed." };
  if (isPlainObject(data.diff)) result.changes = { addedCount: data.diff.addedNodes?.length ?? 0, completedCount: data.diff.completedNodes?.length ?? 0, blockedCount: data.diff.blockedNodes?.length ?? 0, unchangedCount: data.diff.unchangedNodes?.length ?? 0 };
  if (["ingest_execution_receipt", "close_host_outcome"].includes(name) && isPlainObject(data.receipt)) {
    result.artifacts = publicArtifacts(data.receipt.artifacts);
    result.verification = publicArtifacts(data.receipt.validations);
  } else if (Array.isArray(data.artifacts)) {
    const artifacts = publicArtifacts(data.artifacts);
    if (artifacts.length) result.artifacts = artifacts;
  }
  if (name === "run_experience_workflow") {
    result.outcome = data.result ? { summary: safeText(data.result.outcome) } : { summary: "The experiment protocol is ready for host execution." };
    if (data.audit) result.verification = { passed: data.audit.passed === true, findings: safeStrings(data.audit.findings), gaps: safeStrings(data.audit.integrityFlags) };
  }
  if (name === "run_figure_workflow") {
    result.outcome = data.imported ? { imported: true, caption: safeText(data.imported.caption), source: publicPath(data.imported.importedFrom) } : { imported: false, summary: "Figure materials and the drawing prompt are ready for host execution." };
    if (data.qa) result.verification = { status: data.qa.status, findings: safeStrings(data.qa.findings), review: publicReview(data.qa.reviewCoverage) };
  }
  if (name === "prepare_review_exchange") result.artifacts = publicArtifacts(data.reviewedArtifactPaths);
  if (name === "import_review_exchange" && isPlainObject(data.review)) result.review = {
    status: data.review.status,
    verdict: data.review.verdict,
    summary: safeText(data.review.summary),
    artifacts: publicArtifacts(data.review.reviewedArtifactPaths),
    findings: Array.isArray(data.review.findings) ? data.review.findings.map((item) => ({ severity: item?.severity, summary: safeText(item?.summary), artifacts: publicArtifacts(item?.linkedArtifactPaths) })) : [],
    actionItems: safeStrings(data.review.actionItems),
    authoritative: data.review.authority?.authoritative === true
  };
  if (name === "verify_review_coverage") result.review = publicReview(data);
  if (name === "compare_versions" && isPlainObject(data.comparison)) result.changes = {
    added: publicArtifacts(data.comparison.added),
    removed: publicArtifacts(data.comparison.removed),
    changed: publicArtifacts(data.comparison.changed)
  };
  if (isPlainObject(data.authority)) result.authority = { authoritative: data.authority.authoritative === true, reason: safeReason(data.authority.reason) };
  return result;
}

export function publicErrorMessage(name, error) {
  const message = safeText(error instanceof Error ? error.message : String(error)).replaceAll(name, "The requested action");
  if (/\b(?:validated internal state|schema|workspace manifest|contract|receipt|digest|token|exact replay|MutationContext)\b/iu.test(message)) {
    return "The requested action could not complete because recorded internal state is unavailable or no longer current.";
  }
  return message;
}

function dispatchData(root, name, args) {
  switch (name) {
    case "init_dove_goal": return initDoveGoal(root, args);
    case "create_dove_mission": return createDoveMission(root, args);
    case "query_dove_mission": return queryDoveMission(root, args);
    case "query_dove_status": return queryDoveStatus(root, args);
    case "ingest_execution_receipt": return ingestExecutionReceipt(root, args);
    case "close_host_outcome": return closeHostOutcome(root, args);
    case "assess_mission_completion": return assessMissionCompletion(root, args);
    case "search_network": return searchNetwork(root, args);
    case "query_network_search_providers": return queryNetworkSearchProviders(root, args);
    case "query_sources": return querySources(root, args);
    case "query_dove_lessons": return queryDoveLessons(root, args);
    case "record_dove_lesson": return recordDoveLesson(root, args);
    case "register_source": return registerSource(root, args);
    case "verify_source": return verifySource(root, args);
    case "upsert_note": return upsertNote(root, args);
    case "upsert_claims": return upsertClaims(root, args);
    case "run_experience_workflow": return runExperienceWorkflow(root, args);
    case "upsert_draft": return upsertDraft(root, args);
    case "upsert_draft_metadata": return upsertDraftMetadata(root, args);
    case "run_figure_workflow": return runFigureWorkflow(root, args);
    case "prepare_review_exchange": return prepareReviewExchange(root, args);
    case "import_review_exchange": return importReviewExchange(root, args);
    case "verify_review_coverage": return verifyReviewCoverage(root, args);
    case "normalize_rebuttal_issues": return normalizeRebuttalIssues(root, args);
    case "build_rebuttal_strategy": return buildRebuttalStrategy(root, args);
    case "build_rebuttal": return buildRebuttal(root, args);
    case "create_version_snapshot": return createVersionSnapshot(root, args);
    case "compare_versions": return compareVersions(root, args);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

function assertAllowed(name, args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error(`${name} arguments must be a plain object.`);
  const allowed = TOOL_INPUT_PROPERTY_NAMES.get(name);
  if (!allowed) throw new Error(`Unknown tool: ${name}`);
  const unknown = Object.keys(args).filter((field) => !allowed.has(field));
  if (unknown.length) throw new Error(`${name} does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}

function invokeMutation(root, name, callback) {
  const existing = currentMutationContext(root);
  if (existing) return { data: callback(existing), committed: false };
  return {
    data: runWithMutationContext(root, {
      actionId: name.replaceAll("_", "-"),
      mutationMode: "direct-process",
      hostId: "mcp"
    }, callback),
    committed: true
  };
}

function coreCheckpointArgs(name, args) {
  if (name !== "create_dove_mission") return args;
  if (args.operation === "reevaluate-research-tree") {
    if (typeof args.requirement !== "string" || !args.requirement || !Array.isArray(args.nodeUpdates) || args.nodeUpdates.length === 0) {
      throw new Error("Research-tree reevaluation requires a requirement and at least one node update.");
    }
    return {
      ...args,
      nodeUpdates: args.nodeUpdates.map((node) => ({ ...node, lessonId: null }))
    };
  }
  if (typeof args.goal !== "string" || !args.goal) {
    throw new Error("Mission creation requires a goal.");
  }
  return args;
}

function checkpointProposal(root, name, args) {
  if (name === "prepare_review_exchange") return previewReviewExchangePreparation(root, args);
  return dispatchData(root, name, { ...coreCheckpointArgs(name, args), mutationMode: "direct-process" });
}

function applyCheckpoint(root, name, args, proposal) {
  const confirmArgs = proposal?.confirmation?.confirmArgs;
  if (name !== "prepare_review_exchange" && !isPlainObject(confirmArgs)) throw new Error(`${name} did not return private exact replay data.`);
  return invokeMutation(root, name, () => {
    if (name === "prepare_review_exchange") {
      return prepareReviewExchange(root, args, { approvedProposal: proposal.confirmation });
    }
    return dispatchData(root, name, confirmArgs);
  });
}

function recordLesson(root, args) {
  const proposal = recordDoveLesson(root, { ...args, mutationMode: "direct-process" });
  if (!isPlainObject(proposal.confirmation?.confirmArgs)) throw new Error("record_dove_lesson did not return private exact replay data.");
  return invokeMutation(root, "record_dove_lesson", () => recordDoveLesson(root, proposal.confirmation.confirmArgs));
}

function normalizeApprovalAction(value) {
  if (value === "accept" || value === "decline" || value === "cancel") return value;
  throw new Error("Checkpoint approval returned an unsupported action.");
}

function publicCheckpointProposalError(name, args, error) {
  let message = error instanceof Error ? error.message : String(error);
  if (name === "create_dove_mission" && args.operation === "reevaluate-research-tree") {
    message = message.replace(", blockedReasonCode, and lessonId", " and blockedReasonCode");
  }
  if (/\.dove\/|\b(?:proposal(?:Digest|Workspace|Version|Token)|confirmArgs|mutationMode|MutationContext|workspaceId|sourceTreeDigest|archiveTarget)\b/u.test(message)) {
    return new Error("The checkpoint could not be prepared because its validated workspace state is not current.");
  }
  return new Error(message);
}

function checkpointApplyError() {
  return new Error("The approved checkpoint could not be applied because its validated inputs or workspace state changed.");
}

function executeTool(root, name, args, options = {}) {
  const interaction = toolInteractionFor(name, args);
  if (interaction === "checkpoint") {
    if (!CHECKPOINT_TOOL_NAMES.has(name)) throw new Error(`Unsupported checkpoint tool: ${name}`);
    let proposal;
    try {
      proposal = checkpointProposal(root, name, args);
    } catch (error) {
      throw publicCheckpointProposalError(name, args, error);
    }
    const approval = publicResult(name, proposal).approval;
    if (!approval) throw new Error(`${name} did not return a public approval card.`);
    if (typeof options.requestCheckpointApproval !== "function") throw new Error("This Dove checkpoint requires an MCP client with elicitation support.");
    return Promise.resolve(options.requestCheckpointApproval(approval)).then((value) => {
      const action = normalizeApprovalAction(value);
      if (action !== "accept") return {
        status: action === "decline" ? "declined" : "cancelled",
        message: "No changes were made.",
        approval
      };
      let applied;
      try {
        applied = applyCheckpoint(root, name, args, proposal);
      } catch {
        throw checkpointApplyError();
      }
      if (applied.data && typeof applied.data.then === "function") {
        return applied.data
          .then((data) => publicResult(name, resolveExecutionReceiptPostCommit(root, data, { committed: applied.committed })))
          .catch(() => { throw checkpointApplyError(); });
      }
      return publicResult(name, resolveExecutionReceiptPostCommit(root, applied.data, { committed: applied.committed }));
    });
  }
  if (name === "record_dove_lesson") {
    const recorded = recordLesson(root, args);
    if (recorded.data && typeof recorded.data.then === "function") {
      return recorded.data.then((data) => publicResult(name, resolveExecutionReceiptPostCommit(root, data, { committed: recorded.committed })));
    }
    return publicResult(name, resolveExecutionReceiptPostCommit(root, recorded.data, { committed: recorded.committed }));
  }
  if (!MUTATING_TOOL_NAMES.has(name) || (name === "prepare_review_exchange" && args.policy === "local-preflight")) {
    const data = dispatchData(root, name, args);
    return data && typeof data.then === "function" ? data.then((value) => publicResult(name, value)) : publicResult(name, data);
  }
  const invoked = invokeMutation(root, name, () => dispatchData(root, name, args));
  if (invoked.data && typeof invoked.data.then === "function") {
    return invoked.data.then((data) => publicResult(name, resolveExecutionReceiptPostCommit(root, data, { committed: invoked.committed })));
  }
  return publicResult(name, resolveExecutionReceiptPostCommit(root, invoked.data, { committed: invoked.committed }));
}

export function dispatchToolData(root, name, args = {}) {
  return dispatchData(root, name, args);
}

function hostFile(root, value, label) {
  return normalizeHostWorkspaceFilePath(root, value, label);
}

function hostFiles(root, values, label) {
  return Array.isArray(values) ? values.map((value, index) => hostFile(root, value, `${label}[${index}]`)) : values;
}

function hostArtifact(root, value, label) {
  return normalizeHostWorkspaceArtifactPath(root, value, label);
}

function hostArtifacts(root, values, label) {
  return Array.isArray(values) ? values.map((value, index) => hostArtifact(root, value, `${label}[${index}]`)) : values;
}

function hostPaths(root, values, label) {
  return Array.isArray(values) ? values.map((value, index) => normalizeHostWorkspacePath(root, value, `${label}[${index}]`)) : values;
}

function typedEvidence(root, reference, label) {
  if (typeof reference !== "string") return reference;
  for (const prefix of ["source:", "note:"]) if (reference.startsWith(prefix)) return reference;
  for (const prefix of ["artifact:", "validation:"]) {
    if (reference.startsWith(prefix)) return `${prefix}${hostFile(root, reference.slice(prefix.length), label)}`;
  }
  return hostFile(root, reference, label);
}

function typedEvidenceList(root, values, label) {
  return Array.isArray(values) ? values.map((value, index) => typedEvidence(root, value, `${label}[${index}]`)) : values;
}

function missionEvidence(root, reference, label) {
  if (typeof reference !== "string") return reference;
  for (const prefix of ["source:", "note:"]) if (reference.startsWith(prefix)) return reference;
  for (const prefix of ["artifact:", "validation:"]) {
    if (reference.startsWith(prefix)) return `${prefix}${hostArtifact(root, reference.slice(prefix.length), label)}`;
  }
  return reference;
}

function missionEvidenceList(root, values, label) {
  return Array.isArray(values) ? values.map((value, index) => missionEvidence(root, value, `${label}[${index}]`)) : values;
}

function findingReference(root, reference, label) {
  if (typeof reference !== "string") return reference;
  const separator = reference.lastIndexOf("#");
  if (separator <= 0 || separator === reference.length - 1) return reference;
  return `${hostFile(root, reference.slice(0, separator), label)}#${reference.slice(separator + 1)}`;
}

function normalizeHostPathInputs(root, name, args) {
  const result = structuredClone(args);
  switch (name) {
    case "register_source":
      if (result.capturePath !== undefined) result.capturePath = hostFile(root, result.capturePath, "capturePath");
      break;
    case "ingest_execution_receipt":
      if (Array.isArray(result.artifacts)) result.artifacts = result.artifacts.map((item, index) => ({ ...item, path: hostFile(root, item.path, `artifacts[${index}].path`) }));
      if (Array.isArray(result.validations)) result.validations = result.validations.map((item, index) => ({ ...item, reference: hostFile(root, item.reference, `validations[${index}].reference`) }));
      if (Array.isArray(result.criteriaSatisfied)) result.criteriaSatisfied = result.criteriaSatisfied.map((item, index) => ({ ...item, evidenceRefs: typedEvidenceList(root, item.evidenceRefs, `criteriaSatisfied[${index}].evidenceRefs`) }));
      break;
    case "close_host_outcome":
      result.artifactPaths = hostFiles(root, result.artifactPaths, "artifactPaths");
      result.validationPaths = hostFiles(root, result.validationPaths, "validationPaths");
      break;
    case "query_dove_lessons":
      result.artifactRefs = hostArtifacts(root, result.artifactRefs, "artifactRefs");
      break;
    case "record_dove_lesson":
      result.artifactRefs = hostFiles(root, result.artifactRefs, "artifactRefs");
      result.appliesToArtifactRefs = hostFiles(root, result.appliesToArtifactRefs, "appliesToArtifactRefs");
      break;
    case "upsert_note":
    case "create_version_snapshot":
      result.artifactRefs = hostFiles(root, result.artifactRefs, "artifactRefs");
      break;
    case "upsert_claims":
      if (Array.isArray(result.claims)) result.claims = result.claims.map((item, index) => ({ ...item, artifactRefs: hostFiles(root, item.artifactRefs, `claims[${index}].artifactRefs`) }));
      break;
    case "run_experience_workflow":
      result.resultEvidenceRefs = typedEvidenceList(root, result.resultEvidenceRefs, "resultEvidenceRefs");
      break;
    case "upsert_draft":
    case "upsert_draft_metadata":
      result.artifactRefs = hostFiles(root, result.artifactRefs, "artifactRefs");
      result.evidenceRefs = typedEvidenceList(root, result.evidenceRefs, "evidenceRefs");
      break;
    case "run_figure_workflow":
      result.materials = hostFiles(root, result.materials, "materials");
      if (result.outputPath !== undefined) result.outputPath = hostFile(root, result.outputPath, "outputPath");
      break;
    case "prepare_review_exchange":
      result.artifactPaths = hostFiles(root, result.artifactPaths, "artifactPaths");
      result.finalPlanPaths = hostFiles(root, result.finalPlanPaths, "finalPlanPaths");
      result.finalResultPaths = hostFiles(root, result.finalResultPaths, "finalResultPaths");
      break;
    case "verify_review_coverage":
      result.artifactPaths = hostPaths(root, result.artifactPaths, "artifactPaths");
      break;
    case "normalize_rebuttal_issues":
    case "build_rebuttal":
      if (Array.isArray(result.issues)) result.issues = result.issues.map((item, index) => ({ ...item, findingRefs: Array.isArray(item.findingRefs) ? item.findingRefs.map((value, itemIndex) => findingReference(root, value, `issues[${index}].findingRefs[${itemIndex}]`)) : item.findingRefs, evidenceRefs: typedEvidenceList(root, item.evidenceRefs, `issues[${index}].evidenceRefs`) }));
      if (Array.isArray(result.responses)) result.responses = result.responses.map((item, index) => ({ ...item, evidenceRefs: typedEvidenceList(root, item.evidenceRefs, `responses[${index}].evidenceRefs`) }));
      break;
    case "query_dove_mission":
    case "create_dove_mission":
      if (result.targetArtifacts !== undefined) result.targetArtifacts = hostArtifacts(root, result.targetArtifacts, "targetArtifacts");
      if (result.expectedArtifacts !== undefined) result.expectedArtifacts = hostArtifacts(root, result.expectedArtifacts, "expectedArtifacts");
      if (result.evidenceRequirements !== undefined) result.evidenceRequirements = missionEvidenceList(root, result.evidenceRequirements, "evidenceRequirements");
      if (name === "create_dove_mission" && result.operation === "reevaluate-research-tree" && Array.isArray(result.nodeUpdates)) result.nodeUpdates = result.nodeUpdates.map((item, index) => ({ ...item, outcomeEvidenceRefs: typedEvidenceList(root, item.outcomeEvidenceRefs, `nodeUpdates[${index}].outcomeEvidenceRefs`) }));
      break;
    default:
      break;
  }
  return result;
}

export function dispatchTool(root, name, args = {}, options = {}) {
  try {
    assertAllowed(name, args);
    assertMcpInputSchema(name, args, TOOL_INPUT_SCHEMAS.get(name));
    const normalizedArgs = normalizeHostPathInputs(root, name, args);
    const result = executeTool(root, name, normalizedArgs, options);
    return result && typeof result.then === "function"
      ? result.then((value) => textResult(value)).catch((error) => textResult(publicErrorMessage(name, error), true))
      : textResult(result);
  } catch (error) {
    return textResult(publicErrorMessage(name, error), true);
  }
}
