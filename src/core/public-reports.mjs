import { buildPublicStatusProjection, publicMissionNumberForId } from "./mission-queries.mjs";
import { normalizeProjectResearchNarrative, renderProjectResearchNarrative } from "./project-research-narratives.mjs";
import { normalizeResearchNarrative, renderResearchNarrative } from "./research-narratives.mjs";
import { operationCallback, operationForTool, operationPresentation } from "./operation-registry.mjs";
import { reviewerPrompt } from "./role-definitions.mjs";
import { DEFAULT_DOVE_RESPONSE_LANGUAGE } from "./schema.mjs";

const PUBLIC_REASON_MESSAGES = Object.freeze({
  "mission-dependency-incomplete": "A required earlier workstream is not complete.",
  "mission-stopped": "This mission was stopped and preserved as research history.",
  "mission-failed": "This mission failed and is preserved as research history.",
  "explicit-mission-required": "Choose the work item explicitly.",
  "execution-receipt-missing": "No current outcome evidence has been recorded.",
  "execution-receipts-stale-or-invalid": "Recorded outcome evidence is no longer current.",
  "host-outcome-stopped": "The work was stopped before completion.",
  "host-outcome-blocked": "The work is blocked and not complete.",
  "host-outcome-failed": "The work failed and is not complete.",
  "mission-artifact-coverage-missing": "Required outputs are not yet covered by current evidence.",
  "criteria-coverage-missing": "One or more stated completion criteria are not yet covered by current evidence.",
  "evidence-requirements-unmet": "One or more required evidence conditions are not yet satisfied.",
  "required-research-pending": "Required research work is still pending.",
  "required-research-blocked": "Required research work is blocked.",
  "research-decision-not-stop-satisfied": "The current research decision does not say that the objective is satisfied.",
  "research-action-still-authorized": "The current research decision still authorizes an action.",
  "research-evidence-decision-incomplete": "The current research evidence decision is incomplete.",
  "research-outcome-awaiting-reevaluation": "Recorded research execution facts await scientific reevaluation.",
  "research-user-decision-required": "The current scientific judgment requires a user decision before research can continue.",
  "advisory-research-blocked": "Advisory research work is blocked but does not prevent completion.",
  "workspace-not-initialized": "The project research direction has not been set; run /dove:workspace explicitly.",
  "review-evidence-unavailable": "Independent review evidence is unavailable.",
  "source-evidence-unavailable": "Eligible source evidence is unavailable."
});

const PUBLIC_MESSAGES = Object.freeze({
  manage_dove_workspace: "The project research direction was updated.",
  create_dove_mission: "The mission or research update is ready.",
  create_ambient_dove_mission: "Dove recorded the work entry; the requested work has not been completed yet.",
  query_dove_mission: "The work preview is ready.",
  ingest_execution_receipt: "The current outcome evidence was recorded.",
  close_host_outcome: "The work result and supporting evidence were recorded.",
  record_research_outcome: "The research result was recorded with Dove’s next recommendation.",
  assess_mission_completion: "Completion was assessed.",
  query_sources: "The source query finished.",
  read_dove_lessons: "The Lessons document is ready.",
  update_dove_lessons: "The Lessons document was updated.",
  register_source: "The source candidate was recorded.",
  verify_source: "The source audit result was recorded.",
  upsert_claims: "The evidence-backed claims were recorded.",
  run_experience_workflow: "The experiment material was recorded.",
  record_draft_archive: "The project draft was archived.",
  record_figure_archive: "The project figure was archived.",
  scope_review_record: "The frozen review scope is ready for one dedicated Reviewer.",
  archive_review_record: "The non-authoritative review findings were archived.",
  record_rebuttal_archive: "The project rebuttal was archived."
});

const REPORT_SECTION_FIELDS = Object.freeze([
  "executiveSummary",
  "currentSituation",
  "progress",
  "findings",
  "risksAndBlockers",
  "workStatus",
  "evidenceStatus",
  "recommendation",
  "nextActions"
]);

const TECHNICAL_COLLECTION_LIMIT = 100;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepFreezePublic(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const item of Array.isArray(value) ? value : Object.values(value)) deepFreezePublic(item, seen);
  return Object.freeze(value);
}

function publicReferenceName(kind) {
  return {
    workspace: "workspace",
    mission: "work record",
    source: "source",
    claim: "claim",
    experiment: "experiment",
    figure: "figure",
    review: "review",
    lesson: "lesson",
    receipt: "outcome record",
    criterion: "completion condition",
    requirement: "requirement",
    audit: "audit",
    finding: "finding",
    result: "result",
    snapshot: "snapshot",
    node: "research item",
    "work item": "work item",
    "work-item": "work item"
  }[String(kind).toLowerCase()] ?? "record";
}

function safeText(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/(?:^|[\s"'(])\.dove(?:-archive)?(?:[\\/][A-Za-z0-9._\\/-]+)?/gu, " an internal Dove artifact")
    .replace(/(^|[\s"'(\[=])(\/(?:[A-Za-z0-9._@+-]+\/)*[A-Za-z0-9._@+-]+)(?=$|[\s"',;)\]])/gu, "$1a private path")
    .replace(/\b[A-Za-z]:\\[^\s"']+/gu, "a private path")
    .replace(/\b(https?:\/\/)[^\s/@:]+:[^\s/@]+@/giu, "$1[REDACTED]@")
    .replace(/([?&](?:api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|token|client[_-]?secret|secret|password|passwd|key|auth(?:orization)?|code)=)[^&#\s]+/giu, "$1[REDACTED]")
    .replace(/\b((?:authorization|proxy-authorization)\s*:\s*(?:bearer|basic)|(?:bearer|basic))\s+[A-Za-z0-9._~+/=-]+/giu, "$1 [REDACTED]")
    .replace(/\b((?:api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|password|passwd)\s*[:=]\s*)[^\s,;]+/giu, "$1[REDACTED]")
    .replace(/\b[0-9a-f]{64}\b/giu, "the validated fingerprint")
    .replace(/\bexact[ -]?replay(?:\s+data)?\b/giu, "confirmation details")
    .replace(/\bmissionNumber\b/gu, "work number")
    .replace(/\bresearchItemNumber\b/gu, "research item number")
    .replace(/\bdecisionRevision\b/gu, "current research decision")
    .replace(/\b(?:proposal(?:Digest|Workspace|Version|Token)|confirmArgs|confirm|exactReplay|resultMode|mutationMode|MutationContext|confirmed|(?:workspace|mission|source|claim|experiment|figure|review|exchange|lesson|receipt|criterion|requirement|audit|finding|result|snapshot|node|workItem|action|decision|envelope)Ids?|contractDigest|sourceTreeDigest|archiveTarget|seal|ledgerSequence)\b/gu, "validated internal state")
    .replace(/\b(?:source|note|claim|experiment-result|review|lesson|receipt):[a-z0-9._-]+\b/giu, "recorded evidence")
    .replace(/\bUnknown (mission|source|note|claim|experiment|figure|review|exchange|version|lesson|receipt|criterion|requirement|provider|audit|finding|result|snapshot|node|work-item):\s*[a-z0-9._-]+\b/giu, (_match, kind) => `The requested ${publicReferenceName(kind)} was not found`)
    .replace(/\b(Mission|Source|Note|Claim|Experiment|Figure|Review|Exchange|Version|Lesson|Receipt|Criterion|Requirement|Provider|Audit|Finding|Result|Snapshot|Node|Work item)\s+[a-z0-9._-]+(?=\s+(?:belongs|does|is|has|requires|cannot|contains|was)\b)/giu, (_match, kind) => `The requested ${publicReferenceName(kind)}`)
    .replace(/(?<!-)\b(workspace|mission|source|note|claim|experiment|figure|review|exchange|version|lesson|receipt|criterion|requirement|provider|audit|finding|result|snapshot|node|work-item)-[a-z0-9._-]+\b/giu, (_match, kind) => `the referenced ${publicReferenceName(kind)}`);
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

function publicFactStatements(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return [safeText(item)];
    return isPlainObject(item) && typeof item.statement === "string" ? [safeText(item.statement)] : [];
  });
}

const PUBLIC_RESEARCH_JUDGMENTS = Object.freeze({
  "continue-direction": "Continue the current research direction after reviewing the available evidence.",
  "awaiting-reevaluation": "Review the recorded execution facts and evidence before making the next scientific judgment.",
  "stop-low-return": "Pause further research because the recorded return is incomplete or too low to justify another action.",
  "stop-budget": "Stop further research because at least one declared budget limit is exhausted.",
  "block-needs-user": "Pause further research until the user resolves the recorded scope or execution issue.",
  "stop-satisfied": "Stop because the research objective is satisfied.",
  "reject-low-value": "Do not continue with the low-value direction.",
  "reject-policy": "Do not authorize the proposed direction because it does not satisfy the research policy."
});

const PUBLIC_RESEARCH_DEVIATIONS = Object.freeze({
  "performed-action-count-exceeded": "More than the single authorized action was reported.",
  "completed-action-count-mismatch": "The completed outcome did not report exactly one authorized action."
});

function publicResearchDeviation(value) {
  if (PUBLIC_RESEARCH_DEVIATIONS[value]) return PUBLIC_RESEARCH_DEVIATIONS[value];
  if (typeof value === "string" && value.startsWith("budget-exceeded:")) return "The reported execution exceeded a declared budget limit.";
  if (typeof value === "string" && value.startsWith("undeclared-budget-dimension:")) return "The reported execution included an undeclared budget dimension.";
  if (typeof value === "string" && value.startsWith("unexpected-evidence:")) return "The returned evidence did not match the requested research action.";
  return "The reported work did not match the requested research action.";
}

const PUBLIC_RESEARCH_JUDGMENTS_ZH = Object.freeze({
  [PUBLIC_RESEARCH_JUDGMENTS["continue-direction"]]: "Dove 检查现行证据后，在当前任务的固定研究方向内继续。",
  [PUBLIC_RESEARCH_JUDGMENTS["awaiting-reevaluation"]]: "先检查已记录的执行事实和证据，再作出下一项科学判断。",
  [PUBLIC_RESEARCH_JUDGMENTS["stop-low-return"]]: "暂停进一步研究，因为本次回报不完整或不足以支持下一次行动。",
  [PUBLIC_RESEARCH_JUDGMENTS["stop-budget"]]: "停止进一步研究，因为至少一项既定预算已经耗尽。",
  [PUBLIC_RESEARCH_JUDGMENTS["block-needs-user"]]: "暂停进一步研究，等待用户处理已记录的范围或执行问题。",
  [PUBLIC_RESEARCH_JUDGMENTS["stop-satisfied"]]: "研究目标已经满足，可以停止。",
  [PUBLIC_RESEARCH_JUDGMENTS["reject-low-value"]]: "不要继续投入当前低价值方向。",
  [PUBLIC_RESEARCH_JUDGMENTS["reject-policy"]]: "不要授权当前方向，因为它未满足科研策略要求。"
});

function publicResearchJudgment(value) {
  return PUBLIC_RESEARCH_JUDGMENTS[value] ?? "Dove must review the available evidence before deciding whether research should continue.";
}

function chineseResearchJudgment(value) {
  return PUBLIC_RESEARCH_JUDGMENTS_ZH[value] ?? "Dove 需要先检查现行证据，再判断是否继续研究。";
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
      if (typeof item.kind === "string") result.kind = safeText(item.kind);
      for (const field of ["current", "covered"]) if (typeof item[field] === "boolean") result[field] = item[field];
      if (typeof item.status === "string") result.status = safeText(item.status);
      if (typeof item.reason === "string") result.reason = safeReason(item.reason);
    }
    return [result];
  });
}

function publicFieldValue(field, value) {
  if (["message", "error", "summary", "details", "title", "snippet", "sourceName", "displayName", "kind", "access", "status", "locator", "sourceType", "abstract", "lifecycle", "scope"].includes(field)) {
    return typeof value === "string" ? safeText(value) : undefined;
  }
  if (["authors", "capabilities", "nextTimeGuidance", "tags"].includes(field)) return safeStrings(value);
  if (["year", "resultCount", "fetchedCount"].includes(field)) return Number.isFinite(value) ? value : undefined;
  if (field === "openAccess") return typeof value === "boolean" ? value : undefined;
  if (field === "url") return typeof value === "string" ? safeText(value) : undefined;
  if (field === "publishedAt") return typeof value === "string" ? safeText(value) : undefined;
  if (field === "eligibility" && isPlainObject(value)) return { eligible: value.eligible === true, reason: safeReason(value.reason) };
  return undefined;
}

function publicItems(items, fields) {
  if (!Array.isArray(items)) return [];
  return items.filter(isPlainObject).map((item) => Object.fromEntries(fields.flatMap((field) => {
    if (item[field] === undefined) return [];
    const value = publicFieldValue(field, item[field]);
    return value === undefined ? [] : [[field, value]];
  })));
}

function publicOperationalIntegrity(value, fallback = {}) {
  const source = isPlainObject(value) ? value : {};
  return {
    hostActionReturned: source.hostActionReturned === true || fallback.hostActionReturned === true,
    receiptRecorded: source.receiptRecorded === true || fallback.receiptRecorded === true,
    completionEvidenceSatisfied: source.completionEvidenceSatisfied === true,
    lifecycleClosed: source.lifecycleClosed === true
  };
}

function publicCompletion(data) {
  if (!isPlainObject(data)) return null;
  return {
    status: typeof data.status === "string" ? safeText(data.status) : undefined,
    complete: data.complete === true,
    gaps: safeStrings(data.incompleteReasons, safeReason),
    artifacts: publicArtifacts(data.artifactCoverage),
    criteria: Array.isArray(data.criterionCoverage) ? data.criterionCoverage.filter(isPlainObject).map((item) => ({ description: safeText(item.criterion), covered: item.covered === true })) : [],
    requirements: Array.isArray(data.evidenceRequirements) ? data.evidenceRequirements.filter(isPlainObject).map((item) => ({ requirement: safeText(item.requirement), satisfied: item.satisfied === true, reason: safeReason(item.reason) })) : [],
    hostReturn: isPlainObject(data.ordinaryHostReturn?.current) ? {
      status: safeText(data.ordinaryHostReturn.current.status),
      kind: data.ordinaryHostReturn.current.mode === "observation-only" ? "observation" : "files",
      summary: safeText(data.ordinaryHostReturn.current.summary),
      facts: publicFactStatements(data.ordinaryHostReturn.current.facts)
    } : null
  };
}

function publicInvocationClassification(invocation) {
  return {
    outcome: typeof invocation.kind === "string" ? safeText(invocation.kind) : undefined,
    category: typeof invocation.category === "string" ? safeText(invocation.category) : undefined,
    phase: typeof invocation.phase === "string" ? safeText(invocation.phase) : undefined,
    blocking: invocation.blocking === true,
    userAction: typeof invocation.userAction === "string" ? safeText(invocation.userAction) : undefined,
    terminal: invocation.terminal === true,
    continuation: typeof invocation.continuation === "string" ? safeText(invocation.continuation) : undefined,
    closure: typeof invocation.closure === "string" ? safeText(invocation.closure) : undefined,
    retry: typeof invocation.retry === "string" ? safeText(invocation.retry) : undefined,
    ...(typeof invocation.reason === "string" ? { reason: safeText(invocation.reason) } : {})
  };
}

function graphCollection(graph, name) {
  const value = graph?.[name];
  return isPlainObject(value) ? value : { totalCount: 0, truncated: false, items: [] };
}

const PUBLIC_REASON_MESSAGES_ZH = Object.freeze({
  "A required earlier workstream is not complete.": "一项前置工作尚未完成。",
  "This work has been replaced by a newer direction.": "这项工作已被新的方向取代。",
  "Choose the work item explicitly.": "请明确选择要处理的工作项。",
  "No current outcome evidence has been recorded.": "尚未记录当前成果的有效证据。",
  "Recorded outcome evidence is no longer current.": "已有成果证据已不再反映当前状态。",
  "Required outputs are not yet covered by current evidence.": "当前证据尚未覆盖所有必需产出。",
  "One or more stated completion criteria are not yet covered by current evidence.": "一项或多项既定完成标准尚未得到当前证据支持。",
  "One or more required evidence conditions are not yet satisfied.": "一项或多项必需证据条件尚未满足。",
  "Required research work is still pending.": "一项必需的研究工作仍在等待完成。",
  "Required research work is blocked.": "一项必需的研究工作受到阻塞。",
  "The current research decision does not say that the objective is satisfied.": "当前研究判断尚未明确认定研究目标已经满足。",
  "The current research decision still authorizes an action.": "当前研究判断仍授权一项行动。",
  "The current research evidence decision is incomplete.": "当前研究证据判断尚未完成。",
  "Recorded research execution facts await scientific reevaluation.": "已记录的研究执行事实等待科学重新评估。",
  "The current scientific judgment requires a user decision before research can continue.": "当前科学判断需要用户作出决定后才能继续研究。",
  "Advisory research work is blocked but does not prevent completion.": "一项辅助研究工作受到阻塞，但不会阻止整体完成。",
  "Dove is not initialized in this workspace.": "当前工作区尚未初始化 Dove。",
  "Independent review evidence is unavailable.": "尚缺少可用的独立复核证据。",
  "Eligible source evidence is unavailable.": "尚缺少可用且合格的来源证据。",
  "Recorded evidence is unavailable or no longer current.": "已有证据不可用，或已不再反映当前状态。"
});

function chineseReason(value, category = null) {
  const safe = safeReason(value);
  if (typeof safe !== "string" || !safe.trim()) return "有一项完成条件需要处理。";
  if (/\p{Script=Han}/u.test(safe)) return safe;
  if (/^Work \d/u.test(safe)) return safe.replace(/^Work /u, "工作 ").replace(/ do not yet have their declared outputs\./u, " 尚未形成声明成果。").replace(/ have output files, but completion evidence is still incomplete\./u, " 已有成果文件，但完成证据仍不完整。");
  if (PUBLIC_REASON_MESSAGES_ZH[safe]) return PUBLIC_REASON_MESSAGES_ZH[safe];
  return {
    review: "独立复核尚未满足当前成果的确认要求。",
    source: "当前结论仍缺少合格的来源支持。",
    work: "一项必需工作尚未完成或受到阻塞。",
    evidence: "当前证据尚不足以确认成果满足既定要求。",
    direction: "当前工作方向已被更新，需要转向新的有效方向。",
    integrity: "一项必要的完成条件目前缺少有效支持。"
  }[category ?? attentionCategory(safe)] ?? "有一项完成条件需要处理。";
}

function attentionCategory(reason) {
  const normalized = String(reason ?? "").toLowerCase();
  if (normalized.includes("review") || normalized.includes("issuer")) return "review";
  if (normalized.includes("source")) return "source";
  if (normalized.includes("research") || normalized.includes("blocked")) return "work";
  if (normalized.includes("artifact") || normalized.includes("receipt") || normalized.includes("evidence")) return "evidence";
  if (normalized.includes("supersed")) return "direction";
  return "integrity";
}

function publicTechnicalAppendix(data) {
  const graph = data?.durableStatus?.workspaceGraph;
  if (!isPlainObject(graph) || graph.bounded !== true) return null;
  const collection = (name, project) => {
    const source = graphCollection(graph, name);
    const sourceItems = Array.isArray(source.items) ? source.items.filter(isPlainObject) : [];
    const items = sourceItems.slice(0, TECHNICAL_COLLECTION_LIMIT).map(project);
    return {
      totalCount: Number(source.totalCount) || sourceItems.length,
      truncated: source.truncated === true || sourceItems.length > TECHNICAL_COLLECTION_LIMIT,
      items
    };
  };
  const missionNumbers = new Map(graphCollection(graph, "missions").items.filter(isPlainObject).map((item, index) => [item.displayIndex, Number.isSafeInteger(item.displayIndex) ? item.displayIndex + 1 : index + 1]));
  const requirementNumbers = new Map(graphCollection(graph, "requirements").items.filter(isPlainObject).map((item, index) => [item.displayIndex, index + 1]));
  const workItemNumbers = new Map(graphCollection(graph, "workItems").items.filter(isPlainObject).map((item, index) => [item.displayIndex, index + 1]));
  const visibleNumber = (mapping, value) => Number.isSafeInteger(value) ? mapping.get(value) ?? null : null;
  const visibleNumbers = (mapping, values) => Array.isArray(values) ? values.map((value) => visibleNumber(mapping, value)).filter(Number.isSafeInteger) : [];
  return {
    bounded: true,
    workstreams: collection("missions", (item, index) => ({
      number: Number.isSafeInteger(item.displayIndex) ? item.displayIndex + 1 : index + 1,
      mode: item.mode === "research" ? "research" : "ordinary",
      goal: safeText(item.goal),
      state: safeText(item.status),
      complete: item.complete === true,
      dependencyNumbers: visibleNumbers(missionNumbers, item.dependencyDisplayIndices),
      requirementNumbers: visibleNumbers(requirementNumbers, item.requirementDisplayIndices),
      gaps: safeStrings(item.gapCodes, safeReason)
    })),
    requirements: collection("requirements", (item, index) => ({
      number: index + 1,
      workstreamNumber: visibleNumber(missionNumbers, item.missionDisplayIndex),
      kind: safeText(item.kind),
      description: safeText(item.description)
    })),
    workItems: collection("workItems", (item, index) => ({
      number: index + 1,
      workstreamNumber: visibleNumber(missionNumbers, item.missionDisplayIndex),
      label: safeText(item.label),
      kind: safeText(item.kind),
      state: safeText(item.status),
      dependencyNumbers: visibleNumbers(workItemNumbers, item.dependencyDisplayIndices)
    })),
    researchItems: collection("researchItems", (item) => ({
      number: item.missionResearchDisplayIndex + 1,
      workstreamNumber: visibleNumber(missionNumbers, item.missionDisplayIndex),
      question: safeText(item.questionOrHypothesis),
      work: safeText(item.workDescription),
      stopCondition: safeText(item.successOrStopCriterion),
      state: safeText(item.status),
      outcome: safeText(item.outcomeSummary),
      blockedReason: safeReason(item.blockedReasonCode)
    })),
    outcomes: collection("receipts", (item, index) => ({
      number: index + 1,
      workstreamNumber: visibleNumber(missionNumbers, item.missionDisplayIndex),
      summary: item.interpretationStatus === "interpreted" ? "Research execution facts were recorded and interpreted by a later scientific judgment." : safeText(item.summary),
      interpretation: item.interpretationStatus === "interpreted" ? "interpreted" : item.interpretationStatus === "awaiting-reevaluation" ? "awaiting scientific judgment" : null,
      outputCount: Number(item.artifactCount) || 0,
      checkCount: Number(item.validationCount) || 0,
      returnStatus: typeof item.outcomeStatus === "string" ? safeText(item.outcomeStatus) : null,
      returnMode: item.outcomeMode === "observation-only" ? "observation" : item.outcomeMode === "artifact-backed" ? "files" : null,
      factCount: Number(item.factCount) || 0
    })),
    outputs: collection("artifacts", (item, index) => ({
      number: index + 1,
      workstreamNumber: visibleNumber(missionNumbers, item.missionDisplayIndex),
      kind: safeText(item.kind),
      current: true
    })),
    checks: collection("validations", (item, index) => ({
      number: index + 1,
      workstreamNumber: visibleNumber(missionNumbers, item.missionDisplayIndex),
      kind: safeText(item.kind),
      current: true
    })),
    gaps: collection("gaps", (item, index) => ({
      number: index + 1,
      category: item.kind === "research-blocker" ? "work blocker" : "completion",
      description: safeReason(item.code),
      workstreamNumber: visibleNumber(missionNumbers, item.missionDisplayIndex),
      workItemNumber: visibleNumber(workItemNumbers, item.workItemDisplayIndex),
      impact: safeText(item.completionImpact)
    }))
  };
}

function publicStatusBriefing(data, options = {}) {
  const source = isPlainObject(data.publicStatus) ? data.publicStatus : buildPublicStatusProjection(data);
  const narrativeKind = source.narrativeKind === "project" || source.narrativeKind === "mission" ? source.narrativeKind : null;
  const researchNarrative = source.narrativeState === "available" && isPlainObject(source.researchNarrative)
    ? narrativeKind === "project"
      ? normalizeProjectResearchNarrative(source.researchNarrative)
      : normalizeResearchNarrative(source.researchNarrative)
    : null;
  const report = {
    status: typeof source.status === "string" ? safeText(source.status) : "ok",
    detailsAvailable: source.detailsAvailable === true,
    message: safeText(source.message),
    executiveSummary: safeText(source.executiveSummary),
    currentSituation: {
      scope: safeText(source.currentSituation?.scope),
      trackedWorkstreams: Number(source.currentSituation?.trackedWorkstreams) || 0,
      summary: safeText(source.currentSituation?.summary),
      attentionRequired: source.currentSituation?.attentionRequired === true
    },
    progress: {
      state: safeText(source.progress?.state),
      completedItems: Number(source.progress?.completedItems) || 0,
      inProgressItems: Number(source.progress?.inProgressItems) || 0,
      blockedItems: Number(source.progress?.blockedItems) || 0,
      totalItems: Number(source.progress?.totalItems) || 0,
      summary: safeText(source.progress?.summary)
    },
    findings: safeStrings(source.findings),
    risksAndBlockers: Array.isArray(source.risksAndBlockers) ? source.risksAndBlockers.filter(isPlainObject).map((risk) => ({
      whatHappened: safeReason(risk.whatHappened),
      whyItMatters: safeText(risk.whyItMatters),
      impact: safeText(risk.impact),
      evidenceStrength: safeText(risk.evidenceStrength)
    })) : [],
    workStatus: {
      state: safeText(source.workStatus?.state),
      summary: safeText(source.workStatus?.summary),
      currentOutputCount: Number(source.workStatus?.currentOutputCount) || 0,
      currentOutputs: safeStrings(source.workStatus?.currentOutputs).map(publicPath).filter(Boolean),
      returnStatus: typeof source.workStatus?.returnStatus === "string" ? safeText(source.workStatus.returnStatus) : null,
      observationOnly: source.workStatus?.observationOnly === true
    },
    evidenceStatus: {
      state: safeText(source.evidenceStatus?.state),
      summary: safeText(source.evidenceStatus?.summary),
      currentEvidenceCount: Number(source.evidenceStatus?.currentEvidenceCount) || 0,
      sourceCount: Number(source.evidenceStatus?.sourceCount) || 0,
      review: {
        required: false,
        authority: "not-established",
        currentCount: Number(source.evidenceStatus?.review?.currentCount) || 0,
        staleCount: Number(source.evidenceStatus?.review?.staleCount) || 0,
        status: safeText(source.evidenceStatus?.review?.status)
      }
    },
    operationalIntegrity: publicOperationalIntegrity(source.operationalIntegrity),
    researchNarrative,
    narrativeState: source.narrativeState === "available" ? "available" : "unavailable",
    recommendation: safeText(source.recommendation),
    nextActions: Array.isArray(source.nextActions) ? source.nextActions.filter(isPlainObject).map((item) => ({ action: safeText(item.action) })) : []
  };
  if (options.includeTechnicalAppendix === true) {
    const technicalAppendix = publicTechnicalAppendix(data);
    if (technicalAppendix) report.technicalAppendix = technicalAppendix;
  }
  return report;
}

function safeMessage(name, data) {
  if (name === "query_dove_status") return publicStatusBriefing(data).executiveSummary;
  return typeof data?.summary === "string" ? safeText(data.summary) : PUBLIC_MESSAGES[name];
}

function copyPublicTopLevel(result, data) {
  for (const field of ["status", "operation", "policy", "inputBoundary"]) {
    if (typeof data[field] === "string") result[field] = safeText(data[field]);
  }
  for (const field of ["detailsAvailable", "zeroWrite", "complete"]) {
    if (typeof data[field] === "boolean") result[field] = data[field];
  }
}

function assertHumanReportPrivacy(report) {
  const visit = (value, location = "report") => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${location}[${index}]`));
      return;
    }
    if (isPlainObject(value)) {
      for (const [key, item] of Object.entries(value)) {
        if (/^(?:disposition|execution|outcomeClosure|continuation|closure|retry|terminal|researchHandoff|hostControl|closureRequest|tool|exactlyOnce|boundArgs|requiredOutcomeFields|defaults|missionNumber|researchItemNumber|decisionRevision|lessonsBinding|currentHash|binding)$/u.test(key)) {
          throw new Error(`Human report must not contain control field ${location}.${key}.`);
        }
        visit(item, `${location}.${key}`);
      }
      return;
    }
    if (typeof value === "string" && /\b(?:resume[-_ ]?original|host[-_ ]?outcome|research[-_ ]?outcome|host[-_ ]?control|closureRequest|boundArgs|requiredOutcomeFields|exactly[-_ ]?once)\b/iu.test(value)) {
      throw new Error(`Human report must not contain control vocabulary at ${location}.`);
    }
  };
  visit(report);
  return report;
}

function projectPublicReport(name, data, options = {}) {
  if (!isPlainObject(data)) return data;
  const publicOptions = isPlainObject(options) ? options : {};
  if (name === "query_dove_status") return publicStatusBriefing(data, publicOptions);

  const result = {};
  copyPublicTopLevel(result, data);
  result.facts = [];
  result.inferences = [];
  result.recommendations = [];
  result.unknowns = [];
  result.findings = [];
  const currentMainline = name === "manage_dove_workspace" && typeof data?.workspaceRevision?.mainline === "string"
    ? safeText(data.workspaceRevision.mainline)
    : null;
  const message = currentMainline ?? safeMessage(name, data);
  if (message) result.message = message;
  if (currentMainline) {
    if (typeof data.projectBrief === "string" && data.projectBrief.trim()) result.projectBrief = safeText(data.projectBrief);
    result.mainline = currentMainline;
  }
  if (isPlainObject(data.approval)) result.approval = {
    required: data.approval.required === true,
    noChangesApplied: data.approval.noChangesApplied === true,
    summary: safeText(data.approval.summary),
    effects: safeStrings(data.approval.effects),
    question: safeText(data.approval.question)
  };
  if (name === "query_dove_mission" && isPlainObject(data.mission)) result.mission = {
    mode: data.mission.mode === "research" ? "research" : "ordinary",
    goal: safeText(data.mission.goal),
    requirements: safeStrings(data.mission.requirements),
    assumptions: safeStrings(data.mission.assumptions),
    scope: safeStrings(data.mission.scope),
    outOfScope: safeStrings(data.mission.outOfScope),
    artifacts: publicArtifacts(data.mission.artifacts),
    completionCriteria: Array.isArray(data.mission.completionCriteria) ? data.mission.completionCriteria.map((item) => safeText(typeof item === "string" ? item : item?.criterion)).filter(Boolean) : [],
    evidenceRequirements: Array.isArray(data.mission.evidenceRequirements) ? data.mission.evidenceRequirements.map((item) => safeReason(typeof item === "string" ? item : item?.requirement)).filter(Boolean) : []
  };
  if (name === "query_sources") {
    result.sources = publicItems(data.items, ["title", "authors", "year", "locator", "sourceType", "abstract", "lifecycle", "useLimitation", "eligibility"]);
    result.facts = result.sources.map((source) => `Source ${source.title ?? source.locator ?? "candidate"}: ${source.lifecycle === "candidate" && source.eligibility?.eligible === true ? "current captured material" : `not usable (${source.eligibility?.reason ?? source.lifecycle ?? "unknown"})`}.`);
    result.inferences = result.sources.filter((source) => source.eligibility?.eligible === true).map(() => "The current captured material may support a bounded claim only with the explicit not-independently-verified limitation.");
    result.recommendations = result.sources.filter((source) => source.eligibility?.eligible !== true).map(() => "Do not use rejected, missing, or drifted captured material as evidence.");
  }
  if (["read_dove_lessons", "update_dove_lessons"].includes(name) && typeof data.markdown === "string") result.markdown = safeText(data.markdown);
  const completionSource = name === "assess_mission_completion" ? data : data.completion?.assessment;
  const completion = publicCompletion(completionSource);
  if (completion) result.completion = completion;
  else if (data.completion?.assessmentUnavailable === true) result.completion = { status: "unavailable", complete: false, message: "The outcome evidence was recorded, but completion could not be assessed." };
  if (completionSource) {
    result.operationalIntegrity = publicOperationalIntegrity(completionSource.operationalIntegrity, {
      hostActionReturned: name === "close_host_outcome",
      receiptRecorded: isPlainObject(data.receipt)
    });
  } else if (data.completion?.assessmentUnavailable === true) {
    result.operationalIntegrity = publicOperationalIntegrity(null, {
      hostActionReturned: name === "close_host_outcome",
      receiptRecorded: isPlainObject(data.receipt)
    });
  }
  if (data.status === "partial-commit-failure" && isPlainObject(data.partialCommit)) {
    result.partialCommit = {
      committed: data.partialCommit.receiptRecorded === true,
      reassessmentRequired: data.partialCommit.completionAssessmentFailed === true,
      repeatClosureAllowed: data.partialCommit.repeatClosureAllowed === true,
      zeroWriteRetryAllowed: data.partialCommit.zeroWriteRetryAllowed === true,
      nextAction: "Reassess completion using the read-only completion check."
    };
  }
  if (isPlainObject(data.diff)) result.changes = {
    addedCount: data.diff.addedNodes?.length ?? 0,
    completedCount: data.diff.completedNodes?.length ?? 0,
    blockedCount: data.diff.blockedNodes?.length ?? 0,
    unchangedCount: data.diff.unchangedNodes?.length ?? 0
  };
  if (["ingest_execution_receipt", "close_host_outcome", "record_research_outcome"].includes(name) && isPlainObject(data.receipt)) {
    result.artifacts = publicArtifacts(data.receipt.artifacts);
    result.verification = publicArtifacts(data.receipt.validations);
    if (name === "close_host_outcome" && isPlainObject(data.receipt.ordinaryHostOutcome)) {
      result.outcome = {
        status: safeText(data.receipt.ordinaryHostOutcome.status),
        kind: data.receipt.ordinaryHostOutcome.mode === "observation-only" ? "observation" : "files",
        summary: safeText(data.receipt.summary),
        facts: publicFactStatements(data.receipt.ordinaryHostOutcome.facts)
      };
    }
  } else if (Array.isArray(data.artifacts)) {
    const artifacts = publicArtifacts(data.artifacts);
    if (artifacts.length) result.artifacts = artifacts;
  }
  if (name === "close_host_outcome" && isPlainObject(data.researchNarrative)) {
    result.researchNarrative = normalizeResearchNarrative(data.researchNarrative);
  }
  if (name === "create_dove_mission" && data.operation === "reevaluate-research-decision") {
    result.research = {
      nextJudgment: publicResearchJudgment(data.researchDisposition),
      evidenceCount: Number(data.evidenceCount) || 0,
      awaitingExecution: isPlainObject(data.executionHandoff),
      reasonCodes: safeStrings(data.decision?.reasonCodes)
    };
    if (isPlainObject(data.researchNarrative)) result.researchNarrative = normalizeResearchNarrative(data.researchNarrative);
  }
  if (name === "record_research_outcome") {
    result.outcome = {
      accepted: data.accepted === true,
      status: safeText(data.outcomeStatus),
      evidenceComplete: data.evidenceComplete === true,
      missingEvidence: safeStrings(data.missingRequiredEvidence),
      scopeDeviation: data.scopeDeviation === true,
      deviationReasons: safeStrings(data.scopeDeviationReasons, publicResearchDeviation),
      performedActionCount: Number.isSafeInteger(data.performedActionCount) ? data.performedActionCount : 0
    };
    result.research = {
      nextJudgment: publicResearchJudgment(data.awaitingReevaluation ? "awaiting-reevaluation" : data.decision?.disposition),
      awaitingReevaluation: data.awaitingReevaluation === true,
      receiptRecorded: isPlainObject(data.receipt),
      decisionUnchanged: true
    };
  }
  if (name === "run_experience_workflow") {
    result.outcome = data.result ? { summary: safeText(data.result.outcome), status: safeText(data.result.status), denominator: data.result.denominator } : { summary: "The formal Experiment protocol is frozen; no result has been recorded." };
    result.facts.push(data.result ? "The immutable result preserves measurements, the full denominator, failures, deviations, limitations, and current evidence references." : "The formal protocol was frozen before result recording.");
    if (data.result) {
      result.verification = { status: safeText(data.result.status), humanReviewAuthority: false };
      result.unknowns.push(...safeStrings(data.result.limitations));
    } else result.recommendations.push("Run the frozen protocol, preserve raw artifacts and every failure, then record the result.");
  }
  if (["record_draft_archive", "record_figure_archive", "record_rebuttal_archive"].includes(name)) {
    result.artifacts = publicArtifacts([data.artifact]);
    result.facts.push("The substantive artifact remains in the project; Dove recorded only its current Receipt-backed archive reference.");
    result.findings.push(...safeStrings(data.findings));
    result.unknowns.push(...safeStrings(data.qa));
    if (name === "record_figure_archive") result.outcome = { caption: safeText(data.caption) };
  }
  if (name === "scope_review_record") {
    result.artifacts = publicArtifacts(data.reviewedArtifactPaths);
    result.facts.push("The declared artifacts were frozen without changing project state.");
    result.inferences.push("One dedicated fresh read-only Reviewer must assess only this declared scope.");
  }
  if (name === "archive_review_record" && isPlainObject(data.review)) {
    result.review = {
      status: safeText(data.review.status),
      verdict: safeText(data.review.verdict),
      summary: safeText(data.review.summary),
      artifacts: publicArtifacts(data.review.reviewedArtifacts?.map((item) => item.path)),
      findings: Array.isArray(data.review.findings) ? data.review.findings.filter(isPlainObject).map((item) => ({ severity: safeText(item.severity), summary: safeText(item.summary), artifacts: publicArtifacts(item.linkedArtifactPaths) })) : [],
      actionItems: safeStrings(data.review.actionItems),
      authority: "not-established"
    };
    result.facts.push("The returned findings and Markdown report were archived against the exact frozen artifact fingerprints.");
    result.inferences.push("The archive records Reviewer observations but does not establish identity, authority, sign-off, acceptance, or scientific endorsement.");
  }
  if (name === "record_rebuttal_archive") {
    result.facts.push("This is an author-side artifact archive; referenced findings remain preserved and reviewerSignoff is false.");
    result.inferences.push("The rebuttal and revisions are author-side work, not Reviewer acceptance.");
    result.unknowns.push("Reviewer agreement remains unknown until a separate Review establishes it.");
  }
  if (isPlainObject(data.authority)) result.authority = { authoritative: data.authority.authoritative === true, reason: safeReason(data.authority.reason) };
  return result;
}

function publicResearchHandoff(data) {
  if (!isPlainObject(data?.executionHandoff)) return null;
  const action = data.currentResearchDecision?.nextAction ?? data.decision?.nextAction ?? null;
  return Object.freeze({
    ...(isPlainObject(action) ? {
      action: safeText(action.description),
      actionKind: safeText(action.kind),
      rationale: safeText(action.rationale),
      successConditions: Object.freeze(safeStrings(action.successConditions)),
      stopConditions: Object.freeze(safeStrings(action.stopConditions))
    } : {}),
    expectedEvidence: Object.freeze(safeStrings(data.executionHandoff.expectedEvidence)),
    budget: isPlainObject(data.executionHandoff.budget) ? Object.freeze({ ...data.executionHandoff.budget }) : null
  });
}

function publicPresentation(name, invocation, data, options = {}) {
  let policy = "show";
  try {
    policy = operationPresentation(options.operation ?? operationForTool(name), data);
  } catch {
    policy = "show";
  }
  const materialResearchChange = Array.isArray(data?.userDecisionReasons)
    && data.userDecisionReasons.length > 0;
  const visible = policy === "show" || invocation.kind === "failed" || invocation.blocking === true || materialResearchChange;
  return Object.freeze({
    mode: visible ? "show" : "silent",
    reason: materialResearchChange
      ? "material-research-change"
      : invocation.kind === "failed"
        ? "failure"
        : invocation.blocking === true
          ? "blocked"
          : policy === "silent-on-success"
            ? "ambient-create-succeeded"
            : "operation-result"
  });
}

function valueAtPath(value, path) {
  return path.split(".").reduce((current, field) => isPlainObject(current) ? current[field] : undefined, value);
}

function publicOutcomeContract(callback, data) {
  if (callback.outcomeContract?.kind !== "research-execution") return null;
  const evidenceReturned = valueAtPath(data, callback.outcomeContract.evidenceReturnPath);
  const actualUsageLimits = valueAtPath(data, callback.outcomeContract.budgetPath);
  const startedAtNotBefore = valueAtPath(data, callback.outcomeContract.issuedAtPath);
  const finishedAtBefore = valueAtPath(data, callback.outcomeContract.expiresAtPath);
  if (!Array.isArray(evidenceReturned) || evidenceReturned.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error("Research outcome callback projection requires exact returned-evidence labels.");
  }
  if (!isPlainObject(actualUsageLimits) || ["actions", "timeMinutes", "costUnits"].some((field) => !Number.isSafeInteger(actualUsageLimits[field]) || actualUsageLimits[field] < 0)) {
    throw new Error("Research outcome callback projection requires non-negative integer authorized usage limits.");
  }
  if (typeof startedAtNotBefore !== "string" || typeof finishedAtBefore !== "string") {
    throw new Error("Research outcome callback projection requires its execution time window.");
  }
  return Object.freeze({
    evidenceReturned: Object.freeze({
      allowedValues: Object.freeze([...evidenceReturned]),
      exactLabelsOnly: true,
      allExpectedForEvidenceComplete: true
    }),
    actualUsageLimits: Object.freeze({
      actions: actualUsageLimits.actions,
      timeMinutes: actualUsageLimits.timeMinutes,
      costUnits: actualUsageLimits.costUnits,
      fieldTypes: Object.freeze({ actions: "integer", timeMinutes: "integer", costUnits: "integer" }),
      positiveFractions: "round-up-before-reporting",
      serverCoercion: false
    }),
    timestampWindow: Object.freeze({
      startedAtNotBefore,
      finishedAtBefore,
      acceptedUtcFormats: Object.freeze(["YYYY-MM-DDTHH:mm:ssZ", "YYYY-MM-DDTHH:mm:ss.sssZ"]),
      canonicalFormat: "YYYY-MM-DDTHH:mm:ss.sssZ"
    }),
    facts: Object.freeze({
      itemType: "string",
      executionObservationsOnly: true,
      scientificJudgmentAllowed: false
    }),
    artifactPaths: Object.freeze({ projectRelativeExistingFiles: true }),
    validationPaths: Object.freeze({ projectRelativeExistingSeparateFiles: true })
  });
}

function publicOutcomeCallback(name, invocation, data, options = {}) {
  let operation = options.operation;
  if (!operation) {
    try {
      operation = operationForTool(name);
    } catch {
      return null;
    }
  }
  const callback = operationCallback(operation, data);
  if (!callback || invocation.kind === "failed" || invocation.blocking === true) return null;
  const root = options.callbackRoot;
  const resolvers = isPlainObject(options.callbackResolvers) ? options.callbackResolvers : {};
  const resolveMissionNumber = typeof resolvers.missionNumber === "function"
    ? resolvers.missionNumber
    : (missionId) => {
      if (typeof root !== "string" || !root) throw new Error(`${name} outcome callback projection requires a workspace root.`);
      return publicMissionNumberForId(root, missionId, { operation: `${name} outcome callback mission binding` });
    };
  const missionId = valueAtPath(data, callback.missionIdPath);
  if (typeof missionId !== "string" || !missionId) throw new Error(`${name} outcome callback projection requires its durable mission binding.`);
  const missionNumber = resolveMissionNumber(missionId);
  if (!Number.isSafeInteger(missionNumber) || missionNumber < 1) throw new Error(`${name} outcome callback projection requires a one-based public mission number.`);
  const boundArgs = { missionNumber };
  if (callback.decisionRevisionPath) {
    const decisionRevision = valueAtPath(data, callback.decisionRevisionPath);
    if (!Number.isSafeInteger(decisionRevision) || decisionRevision < 1) throw new Error(`${name} outcome callback projection requires a positive decision revision.`);
    boundArgs.decisionRevision = decisionRevision;
  }
  return Object.freeze({
    tool: callback.tool,
    mode: callback.mode,
    exactlyOnce: true,
    boundArgs: Object.freeze(boundArgs),
    requiredOutcomeFields: Object.freeze([...callback.requiredOutcomeFields]),
    defaults: deepFreezePublic(structuredClone(callback.defaults)),
    ...(callback.outcomeContract ? { outcomeContract: publicOutcomeContract(callback, data) } : {})
  });
}

function publicLessonsDocumentControl(name, data) {
  if (name !== "read_dove_lessons" || typeof data?.lessonsBinding !== "string" || typeof data?.currentHash !== "string") return null;
  return Object.freeze({
    binding: data.lessonsBinding,
    currentHash: data.currentHash
  });
}

function reviewMissionControl(name, data) {
  if (name !== "create_dove_mission" || data?.operation !== "start-skill" || data?.skill !== "review" || typeof data?.reviewMissionBinding !== "string") return null;
  return Object.freeze({ binding: data.reviewMissionBinding });
}

function reviewLaunchControl(name, data) {
  if (name !== "scope_review_record" || !isPlainObject(data?.scopeBinding) || !isPlainObject(data?.reviewerLaunch)) return null;
  return Object.freeze({
    ...data.reviewerLaunch,
    prompt: reviewerPrompt(data.scopeBinding),
    scopeBinding: deepFreezePublic(structuredClone(data.scopeBinding))
  });
}

function publicHostControl(name, invocation, data, options = {}) {
  const classification = publicInvocationClassification(invocation);
  const lessonsDocument = publicLessonsDocumentControl(name, data);
  const reviewMission = reviewMissionControl(name, data);
  const reviewerLaunch = reviewLaunchControl(name, data);
  return Object.freeze({
    classification: Object.freeze(classification),
    presentation: publicPresentation(name, invocation, data, options),
    closureRequest: publicOutcomeCallback(name, invocation, data, options),
    ...(lessonsDocument ? { lessonsDocument } : {}),
    ...(reviewMission ? { reviewMission } : {}),
    ...(reviewerLaunch ? { reviewerLaunch } : {})
  });
}

export function publicResult(name, data, invocation, options = {}) {
  if (!isPlainObject(invocation)) throw new Error("Public result requires an invocation classification.");
  const report = assertHumanReportPrivacy(projectPublicReport(name, data, options));
  const researchHandoff = data?.executionHandoff && (name === "create_ambient_dove_mission" || name === "create_dove_mission") ? publicResearchHandoff(data) : null;
  const selector = options.selector;
  if (selector !== undefined && (!isPlainObject(selector) || Object.keys(selector).length !== 1 || !Number.isSafeInteger(selector.missionNumber) || selector.missionNumber < 1)) {
    throw new Error("Public result selector requires exactly one positive missionNumber.");
  }
  return deepFreezePublic({
    report,
    ...(selector ? { selector: { missionNumber: selector.missionNumber } } : {}),
    ...(researchHandoff ? { researchHandoff } : {}),
    hostControl: publicHostControl(name, invocation, data, options)
  });
}

export function publicErrorResult(name, error, invocation) {
  if (!isPlainObject(invocation)) throw new Error("Public error result requires an invocation classification.");
  return deepFreezePublic({
    report: assertHumanReportPrivacy({ status: "blocked", message: publicErrorMessage(name, error) }),
    hostControl: publicHostControl(name, invocation, null)
  });
}

export function publicErrorMessage(name, error) {
  const rawMessage = safeText(error instanceof Error ? error.message : String(error));
  const message = rawMessage
    .replaceAll(name, "The requested action")
    .replace(/\bhost[-_ ]?outcome\b/giu, "execution result")
    .replace(/\bresearch[-_ ]?outcome\b/giu, "research result")
    .replace(/\b(?:closureRequest|boundArgs|requiredOutcomeFields|exactly[-_ ]?once)\b/giu, "the supplied request contract");
  if (name === "record_research_outcome" && /returned evidence does not match the current research handoff/iu.test(message)) {
    return "evidenceReturned must use only the exact labels supplied in the closure request outcomeContract; put file paths in artifactPaths or validationPaths and descriptive observations in facts.";
  }
  if (name === "close_host_outcome" && /artifact and validation paths must be canonically distinct/iu.test(message)) {
    return "Artifact and validation paths must be different. Omit validationPaths when validation only checked an artifact in place, or provide a separate validation output file.";
  }
  if (name === "close_host_outcome" && /already been recorded with different immutable content/iu.test(message)) {
    return "This work already has a different recorded return and cannot be silently replaced.";
  }
  if (name === "run_experience_workflow" && /result\.checks must report every frozen protocol check exactly once and in order/iu.test(rawMessage)) {
    return "The experiment result must include every check from the frozen protocol once, preserving the same order.";
  }
  if (name === "create_dove_mission" && /(?:references unknown requirement|references unknown mission reference|selectedOption must name one declared option|work graph contains a cycle)/iu.test(message)) {
    return "The mission details are internally inconsistent. Submit only the goal and any complete simple scope, artifact, completion, or typed evidence fields; omit partial requirement, alignment, decision, and work-item structures.";
  }
  if (/must name one canonical regular file or future file inside the workspace/iu.test(message)) {
    return "The provided file reference is invalid. Select one regular file or future file inside the workspace.";
  }
  if (/requires MCP elicitation support/iu.test(message)) {
    return "The client cannot request the confirmation needed to continue.";
  }
  if (/approval handler failed/iu.test(message)) {
    return "The request could not be completed.";
  }
  if ((name === "create_ambient_dove_mission" && /requires a current Dove workspace/iu.test(message))
    || /requires a current Dove workspace.*\/dove:workspace.*research mainline/iu.test(message)) {
    return "The project research mainline has not been established. Run /dove:workspace explicitly before starting new work.";
  }
  if (name === "create_ambient_dove_mission" && /(?:changes|requires changing) the project research mainline/iu.test(message)) {
    return "This request would change the project research mainline. Run /dove:workspace explicitly and approve the new direction first.";
  }
  if (/\b(?:validated internal state|schema|workspace manifest|contract|receipt|digest|token|exact replay|MutationContext|canonical workspace)\b/iu.test(message)) {
    return "The requested action could not complete because recorded internal state is unavailable or no longer current.";
  }
  return message;
}

function reportLine(value, fallback = "None") {
  return typeof value === "string" && value.trim() ? safeText(value).trim() : fallback;
}

function chineseStatusText(report) {
  const complete = report.workStatus?.state === "complete" || report.progress?.state === "complete";
  const hasCurrentWork = report.workStatus?.state === "work-produced" || Number(report.workStatus?.currentOutputCount) > 0;
  const blocked = report.workStatus?.state === "blocked" || Number(report.progress?.blockedItems) > 0;
  const tracked = Number(report.currentSituation?.trackedWorkstreams) || 0;
  const completed = Number(report.progress?.completedItems) || 0;
  const pending = Number(report.progress?.inProgressItems) || 0;
  const blockedCount = Number(report.progress?.blockedItems) || 0;
  const outputCount = Number(report.workStatus?.currentOutputCount) || 0;
  const currentOutputs = safeStrings(report.workStatus?.currentOutputs);
  const evidenceCount = Number(report.evidenceStatus?.currentEvidenceCount) || 0;
  const sourceCount = Number(report.evidenceStatus?.sourceCount) || 0;
  const operationalIntegrity = report.operationalIntegrity ?? {};
  const review = report.evidenceStatus?.review ?? {};
  const observationOnly = report.workStatus?.observationOnly === true;
  const hostReturnStatus = typeof report.workStatus?.returnStatus === "string" ? report.workStatus.returnStatus : null;
  const hostStatusZh = { completed: "完成", blocked: "阻塞", failed: "失败", stopped: "停止" }[hostReturnStatus] ?? hostReturnStatus;
  const executiveSummary = complete
    ? "当前工作已通过完成门，但验收与生产就绪状态需要分别查看。"
    : hostReturnStatus === "completed" && operationalIntegrity.hostActionReturned === true
      ? "主机动作已返回完成状态，但完成证据或生命周期关闭仍未满足，因此当前工作尚未完成。"
    : ["blocked", "failed", "stopped"].includes(hostReturnStatus)
      ? `工作以${hostStatusZh}状态结束，当前尚未完成。`
      : hasCurrentWork
      ? "已经产出可用成果，但仍有部分完成条件或证据需要补齐。"
      : blocked
        ? "当前工作在形成可用成果之前受到阻塞。"
        : "当前工作仍在推进，尚未记录可用成果。";
  const currentSituation = tracked === 0
    ? "当前还没有纳入跟踪的工作任务。"
    : `当前跟踪 ${tracked} 项工作；${Array.isArray(report.risksAndBlockers) ? report.risksAndBlockers.length : 0} 项重要风险或阻塞需要关注。`;
  const progress = completed + pending + blockedCount > 0
    ? `已完成 ${completed} 项，进行中 ${pending} 项，阻塞 ${blockedCount} 项。`
    : hasCurrentWork ? "当前已有可用成果。" : "目前没有可汇报的分项进展。";
  const findings = [];
  if (currentOutputs.length > 0) findings.push(`当前可见的成果文件包括：${currentOutputs.join("、")}${outputCount > currentOutputs.length ? `，另有 ${outputCount - currentOutputs.length} 项` : ""}。`);
  else if (outputCount > 0) findings.push(`当前有 ${outputCount} 项可用成果。`);
  if (completed > 0) findings.push(`${completed} 项工作已达到既定完成条件。`);
  if (sourceCount > 0) findings.push(`当前范围内有 ${sourceCount} 项来源材料可供使用。`);
  if (Number(review.currentCount) > 0) findings.push(`当前有 ${Number(review.currentCount)} 项非权威复核归档。`);
  if (Number(review.staleCount) > 0) findings.push(`有 ${Number(review.staleCount)} 项复核归档已过期。`);
  if (complete && findings.length === 0) findings.push("既定完成条件已经满足。 ");
  const outputSummary = currentOutputs.length > 0 ? `，包括 ${currentOutputs.join("、")}` : "";
  const workStatus = complete
    ? `纳入跟踪的工作已经满足既定完成条件${outputSummary}。`
    : hostReturnStatus === "completed" && operationalIntegrity.hostActionReturned === true
      ? `主机动作已经返回完成状态${outputSummary}，但完成证据或生命周期关闭仍然开放。`
    : ["blocked", "failed", "stopped"].includes(hostReturnStatus)
      ? `工作以${hostStatusZh}状态结束，仍未完成。`
      : hasCurrentWork
      ? `当前已经有实际成果${outputSummary}；剩余问题主要是验证、复核或个别未完成事项，而不是尚未开展工作。`
      : blocked ? "必需工作受到阻塞，尚未形成当前可用成果。" : tracked > 0 ? "工作正在推进，但尚未记录当前成果。" : "尚未开始纳入跟踪的工作。";
  const evidenceStatus = report.evidenceStatus?.state === "ready"
    ? "当前证据足以支持完成判断。"
    : report.evidenceStatus?.state === "evidence-recording-missing"
      ? "成果文件已经存在，但仍缺少支持完成判断的现行证据。"
      : evidenceCount > 0
        ? "当前已有证据，但仍有一项或多项完成条件需要补充支持。"
          : "尚未记录当前成果的有效证据。";
  return { executiveSummary, currentSituation, progress, findings, workStatus, evidenceStatus };
}

function chineseAction(value, fallback = "继续处理优先级最高的未完成工作，并补充对应证据。") {
  const text = reportLine(value, "");
  if (!text) return fallback;
  if (/\p{Script=Han}/u.test(text)) return text;
  const normalized = text.toLowerCase();
  if (normalized.includes("independent review")) return "为当前成果补充或更新独立复核。";
  if (normalized.includes("source")) return "核验所需来源，或改用符合要求的证据。";
  if (normalized.includes("blocker") || normalized.includes("alternative direction")) return "解决当前阻塞；如果原方向不可行，请明确选择有依据的替代方向。";
  if (normalized.includes("evidence") || normalized.includes("output") || normalized.includes("check")) return "更新受影响成果和检查项的现行证据。";
  if (normalized.includes("newer") || normalized.includes("active direction")) return "转向更新后的有效工作方向。";
  if (normalized.includes("initialize")) return "先初始化 Dove，再建立第一项工作。";
  if (normalized.includes("create") && normalized.includes("work")) return "建立第一项具体工作并开始执行。";
  if (normalized.includes("choose") || normalized.includes("select")) return "从当前可见工作中明确选择下一项要处理的内容。";
  if (normalized.includes("completion") || normalized.includes("gap")) return "处理当前缺口后重新评估完成情况。";
  return fallback;
}

function chineseOperationMessage(report) {
  const message = reportLine(report.message, "");
  if (message && /\p{Script=Han}/u.test(message)) return message;
  if (/artifact and validation paths must be different/iu.test(message)) return "成果文件与验证输出必须是不同文件。若只是原地检查成果，请省略 validationPaths；只有实际生成了独立验证输出文件时才填写。";
  if (/internally inconsistent/iu.test(message)) return "任务详情内部不一致。请只保留具体目标，以及完整的范围、文件、完成条件或带类型的证据字段；不要提交不完整的需求、对齐、决策或工作项结构。";
  if (/provided file reference is invalid/iu.test(message)) return "文件引用无效。请选择工作区内的常规文件或未来文件。";
  if (/client (?:lacks the capability needed|cannot request the confirmation needed)/iu.test(message)) return "客户端缺少继续当前检查点所需的能力。";
  if (/request could not be completed/iu.test(message)) return "请求未能完成。";
  if (report.status === "blocked") return message || "请求未能完成。";
  if (isPlainObject(report.approval) && report.approval.required === true) return "需要确认后才能继续。";
  if (report.status === "declined") return "已取消本次更改，没有写入任何内容。";
  if (report.status === "cancelled") return "本次操作已取消，没有写入任何内容。";
  if (report.status === "initialized") return "Dove 项目记录已准备好。";
  if (report.status === "materialized") return /requested work has not been completed yet/iu.test(message)
    ? "Dove 已记录工作入口；用户请求的实际工作尚未完成。"
    : "工作记录已建立；这不表示用户请求的实际工作已经完成。";
  if (report.status === "partial-commit-failure") return "成果证据已经记录，但完成评估失败；不要重复提交关闭操作，请使用只读完成检查重新评估。";
  if (report.status === "replayed") return "相同的结果回报已经记录；本次为零写入重放。";
  if (report.status === "no-progress-skipped") return "本次没有形成新的可记录进展。";
  if (report.status === "ingested") return "当前成果证据已记录。";
  if (report.status === "recorded") return "请求的内容已记录。";
  if (report.status === "imported") return "返回的审阅结果已导入。";
  if (report.status === "compared") return "所选版本已完成比较。";
  if (report.status === "ok") return "查询已完成。";
  return "操作已完成。";
}

function renderStatusReport(report, language) {
  const zh = language === "zh" || language.startsWith("zh-");
  const headings = zh ? {
    current: "当前状态",
    evidence: "结果与证据",
    risksAndBlockers: "不确定性与阻碍",
    recommendation: "建议",
    nextActions: "下一步"
  } : {
    current: "Current status",
    evidence: "Results and evidence",
    risksAndBlockers: "Uncertainty and blockers",
    recommendation: "Recommendation",
    nextActions: "Next step"
  };
  const none = zh ? "无" : "None";
  const localized = zh ? chineseStatusText(report) : null;
  const lines = [];
  if (report.narrativeState === "available" && isPlainObject(report.researchNarrative)) {
    const renderedNarrative = Object.hasOwn(report.researchNarrative, "activeDirections")
      ? renderProjectResearchNarrative(report.researchNarrative, { language: zh ? "zh" : "en" })
      : renderResearchNarrative(report.researchNarrative, { language: zh ? "zh" : "en" });
    lines.push(zh ? "科研脉络" : "Research narrative", renderedNarrative, "");
  }
  const currentLines = [
    localized?.executiveSummary ?? reportLine(report.executiveSummary, none)
  ];
  const situation = localized?.currentSituation ?? reportLine(report.currentSituation?.summary, none);
  const progress = localized?.progress ?? reportLine(report.progress?.summary, none);
  if (situation !== none && situation !== currentLines[0]) currentLines.push(situation);
  if (progress !== none && !currentLines.includes(progress)) currentLines.push(progress);
  lines.push(headings.current, ...currentLines);

  const findings = zh ? localized.findings : safeStrings(report.findings);
  const evidenceLines = [];
  if (findings.length) evidenceLines.push(...findings.map((item) => `- ${item}`));
  if (isPlainObject(report.operationalIntegrity)) {
    const integrity = report.operationalIntegrity;
    evidenceLines.push(
      zh ? `- 主机动作已返回：${integrity.hostActionReturned ? "是" : "否"}` : `- Host action returned: ${integrity.hostActionReturned ? "yes" : "no"}`,
      zh ? `- 成果证据已记录：${integrity.receiptRecorded ? "是" : "否"}` : `- Receipt recorded: ${integrity.receiptRecorded ? "yes" : "no"}`,
      zh ? `- 完成证据已满足：${integrity.completionEvidenceSatisfied ? "是" : "否"}` : `- Completion evidence satisfied: ${integrity.completionEvidenceSatisfied ? "yes" : "no"}`,
      zh ? `- 生命周期已关闭：${integrity.lifecycleClosed ? "是" : "否"}` : `- Lifecycle closed: ${integrity.lifecycleClosed ? "yes" : "no"}`
    );
  }
  const workStatus = localized?.workStatus ?? reportLine(report.workStatus?.summary, none);
  const evidenceStatus = localized?.evidenceStatus ?? reportLine(report.evidenceStatus?.summary, none);
  if (workStatus !== none && !currentLines.includes(workStatus)) evidenceLines.push(workStatus);
  if (evidenceStatus !== none && !currentLines.includes(evidenceStatus) && evidenceStatus !== workStatus) evidenceLines.push(evidenceStatus);
  if (evidenceLines.length) lines.push("", headings.evidence, ...evidenceLines);
  const risks = Array.isArray(report.risksAndBlockers) ? report.risksAndBlockers.filter(isPlainObject) : [];
  if (risks.length) lines.push("", headings.risksAndBlockers);
  for (const risk of risks) {
    if (zh) {
      const category = attentionCategory(risk.whatHappened);
      const guidance = {
        review: ["最终确认前仍需要独立复核。", "当前成果可能已经可用，但最终签核仍未完成。"],
        source: ["当前结论依赖尚未达到使用条件的来源材料。", "相关主张可能仍缺少支持，或需要调整。"],
        work: ["必需工作尚不能达到既定完成条件。", "在阻塞解决或方向调整前，相关结果仍不完整。"],
        evidence: ["需要现行证据证明成果仍符合既定要求。", "即使已有实际成果，也暂时无法确认整体完成。"],
        direction: ["继续旧方向可能造成重复工作或产生冲突结果。", "后续投入可能无法支持当前目标。"],
        integrity: ["一项必要的完成条件目前缺少有效支持。", "整体结果暂不应被表述为已经充分验证。"]
      }[category];
      lines.push(`- 发生了什么：${chineseReason(risk.whatHappened, category)}`);
      lines.push(`  为什么重要：${typeof risk.whyItMatters === "string" && /\p{Script=Han}/u.test(risk.whyItMatters) ? risk.whyItMatters : guidance[0]}`);
      lines.push(`  影响：${typeof risk.impact === "string" && /\p{Script=Han}/u.test(risk.impact) ? risk.impact : guidance[1]}`);
      lines.push("  证据强度：较强");
    } else {
      lines.push(`- What happened: ${reportLine(risk.whatHappened, none)}`);
      lines.push(`  Why it matters: ${reportLine(risk.whyItMatters, none)}`);
      lines.push(`  Impact: ${reportLine(risk.impact, none)}`);
      lines.push(`  Evidence strength: ${reportLine(risk.evidenceStrength, none)}`);
    }
  }
  if (report.narrativeState !== "available") {
    const recommendation = zh && /No current research judgment is available/iu.test(report.recommendation)
      ? "当前没有可用的科研判断；状态不会根据进度或风险启发式生成建议。"
      : reportLine(report.recommendation, none);
    lines.push("", headings.recommendation, recommendation);
  }
  const actions = Array.isArray(report.nextActions) ? report.nextActions.filter(isPlainObject) : [];
  if (actions.length) lines.push("", headings.nextActions, ...actions.map((item, index) => `${index + 1}. ${zh ? chineseAction(item.action) : reportLine(item.action, none)}`));
  return lines.join("\n");
}

function finalOutcomeLead(report, zh) {
  if (!isPlainObject(report.outcome) || typeof report.outcome.status !== "string") return null;
  const status = report.outcome.status;
  const summary = reportLine(report.outcome.summary, zh ? "没有提供结果摘要。" : "No result summary was provided.");
  if (status === "completed") return zh ? `主机动作已返回完成状态：${summary}` : `The host action returned completed: ${summary}`;
  if (status === "blocked") return zh ? `工作受到阻塞，尚未完成：${summary}` : `The work is blocked and incomplete: ${summary}`;
  if (status === "failed") return zh ? `工作执行失败，尚未完成：${summary}` : `The work failed and is incomplete: ${summary}`;
  if (status === "stopped") return zh ? `工作已停止，尚未完成：${summary}` : `The work stopped and is incomplete: ${summary}`;
  return null;
}

function renderOperationReport(report, language) {
  const zh = language === "zh" || language.startsWith("zh-");
  if (typeof report.markdown === "string" && report.markdown.trim()) return report.markdown;
  if (typeof report.mainline === "string" && report.mainline.trim()) {
    const mainline = report.mainline.trim();
    const projectBrief = typeof report.projectBrief === "string" ? report.projectBrief.trim() : "";
    return projectBrief ? `${projectBrief}\n\n${mainline}` : mainline;
  }
  if (isPlainObject(report.approval) && report.approval.required === true) {
    const none = zh ? "无" : "None";
    if (zh) {
      const effects = safeStrings(report.approval.effects);
      return [
        "需要确认后才能继续。",
        report.approval.noChangesApplied === true ? "尚未应用任何更改。" : "更改尚未完成。",
        "确认后将执行：",
        ...(effects.length ? effects.map((effect, index) => `- ${chineseAction(effect, `应用预览中列出的第 ${index + 1} 项更改。`)}`) : [`- ${none}`]),
        "是否继续？"
      ].join("\n");
    }
    const lines = [
      reportLine(report.approval.summary, "Approval is required before continuing."),
      report.approval.noChangesApplied === true ? "No files have been created or changed." : "The changes have not been completed.",
      "If approved, Dove will:"
    ];
    const effects = safeStrings(report.approval.effects);
    lines.push(...(effects.length ? effects.map((effect) => `- ${effect}`) : [`- ${none}`]));
    lines.push(reportLine(report.approval.question, "Continue?"));
    return lines.join("\n");
  }
  const lead = finalOutcomeLead(report, zh);
  const primaryMessage = lead ?? (zh ? chineseOperationMessage(report) : reportLine(report.message, "The operation completed."));
  const lines = [primaryMessage];
  if (isPlainObject(report.operationalIntegrity)) {
    const integrity = report.operationalIntegrity;
    lines.push(
      "",
      zh ? "运行完整性" : "Operational integrity",
      zh ? `- 主机动作已返回：${integrity.hostActionReturned ? "是" : "否"}` : `- Host action returned: ${integrity.hostActionReturned ? "yes" : "no"}`,
      zh ? `- 成果证据已记录：${integrity.receiptRecorded ? "是" : "否"}` : `- Receipt recorded: ${integrity.receiptRecorded ? "yes" : "no"}`,
      zh ? `- 完成证据已满足：${integrity.completionEvidenceSatisfied ? "是" : "否"}` : `- Completion evidence satisfied: ${integrity.completionEvidenceSatisfied ? "yes" : "no"}`,
      zh ? `- 生命周期已关闭：${integrity.lifecycleClosed ? "是" : "否"}` : `- Lifecycle closed: ${integrity.lifecycleClosed ? "yes" : "no"}`
    );
  }
  if (isPlainObject(report.partialCommit)) {
    lines.push("", zh ? "部分提交失败：成果证据已提交，但完成评估失败。请勿重复关闭或按零写入重试；请执行只读完成重新评估。" : "Partial commit failure: the receipt was committed, but completion assessment failed. Do not repeat closure or retry as zero-write; run the read-only completion reassessment.");
  }
  if (isPlainObject(report.researchNarrative)) lines.push("", renderResearchNarrative(report.researchNarrative, { language: zh ? "zh" : "en" }));
  if (isPlainObject(report.outcome)) {
    const outcome = report.outcome.summary ?? report.outcome.caption;
    if (typeof outcome === "string" && !primaryMessage.includes(reportLine(outcome, ""))) lines.push(`${zh ? "结果" : "Outcome"}: ${reportLine(outcome, zh ? "结果已准备好。" : "The result is ready.")}`);
    else if (typeof report.outcome.accepted === "boolean") {
      lines.push(`${zh ? "执行结果" : "Execution outcome"}: ${report.outcome.accepted ? (zh ? "已接受" : "accepted") : (zh ? "未接受" : "not accepted")}`);
      lines.push(`${zh ? "证据" : "Evidence"}: ${report.outcome.evidenceComplete === true ? (zh ? "完整" : "complete") : (zh ? "不完整" : "incomplete")}`);
      if (report.outcome.scopeDeviation === true) lines.push(zh ? "范围偏差：已检测到。" : "Scope deviation: detected.");
    }
  }
  if (isPlainObject(report.research)) {
    const researchJudgment = zh
      ? chineseResearchJudgment(report.research.nextJudgment)
      : reportLine(report.research.nextJudgment, "Awaiting research judgment.");
    lines.push(`${zh ? "Dove 下一判断" : "Dove next judgment"}: ${researchJudgment}`);
    if (report.research.awaitingReevaluation === true) lines.push(zh ? "执行事实已记录，但当前科学判断尚未消费该 Receipt。" : "Execution facts were recorded, but the current scientific judgment has not consumed the receipt.");
    if (Array.isArray(report.research.reasonCodes) && report.research.reasonCodes.length > 0) lines.push(`${zh ? "判断原因" : "Decision reasons"}: ${report.research.reasonCodes.join(", ")}`);
  }
  if (isPlainObject(report.completion)) {
    const label = report.completion.complete === true ? (zh ? "已完成" : "complete") : (zh ? "尚未完成" : "not complete");
    lines.push(`${zh ? "完成情况" : "Completion"}: ${label}`);
    for (const gap of safeStrings(report.completion.gaps)) lines.push(`- ${zh ? chineseReason(gap) : gap}`);
  }
  if (isPlainObject(report.review)) {
    if (typeof report.review.summary === "string") lines.push(`${zh ? "审阅结论" : "Review"}: ${reportLine(report.review.summary)}`);
    else lines.push(`${zh ? "复核归档" : "Review archives"}: ${Number(report.review.currentCount) || 0} ${zh ? "项现行，" : "current, "}${Number(report.review.staleCount) || 0} ${zh ? "项过期" : "stale"}`);
  }
  return lines.join("\n");
}

export function renderPublicReport(report, { language = DEFAULT_DOVE_RESPONSE_LANGUAGE } = {}) {
  if (!isPlainObject(report)) return reportLine(report, "");
  const isStatusReport = REPORT_SECTION_FIELDS.every((field) => Object.hasOwn(report, field));
  return isStatusReport ? renderStatusReport(report, language) : renderOperationReport(report, language);
}
