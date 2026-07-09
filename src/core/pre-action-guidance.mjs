import {
  ARTIFACT_PATHS,
  DOVE_PRIMARY_ROLES,
  PRIMARY_ROLE_IDS,
  ROLE_HIERARCHY,
  doveExecutionContractReadiness,
  doveExecutionCriteriaCoverage,
  normalizeDoveExecutionContract,
  normalizeDoveVerifiedCriteria
} from "./schema.mjs";

const FULL_LESSON_LIMIT = 5;
const DEFAULT_LESSON_LIMIT = 3;

function text(responseLanguage, zh, en) {
  return responseLanguage === "en" ? en : zh;
}

function normalizeString(value, fallback = null) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean)));
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function normalizeObjectArray(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) : [];
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeSurface(surface) {
  const normalized = normalizeString(surface, "dove.status").replace(/^project:/, "");
  return normalized.startsWith("dove.") ? normalized : `dove.${normalized}`;
}

function normalizeRoleId(roleId) {
  const normalized = normalizeString(roleId, null);
  if (!normalized || !ROLE_HIERARCHY[normalized]) {
    return null;
  }
  const role = ROLE_HIERARCHY[normalized];
  return role.kind === "primary" ? role.id : role.parentRole ?? null;
}

function canonicalSubagentId(roleId) {
  const normalized = normalizeString(roleId, null);
  if (!normalized || !ROLE_HIERARCHY[normalized]) {
    return null;
  }
  const role = ROLE_HIERARCHY[normalized];
  if (role.kind === "primary") {
    return null;
  }
  return role.canonicalRole ?? role.aliasOf ?? role.id;
}

function roleLabel(roleId) {
  return DOVE_PRIMARY_ROLES.find((role) => role.id === roleId)?.label ?? ROLE_HIERARCHY[roleId]?.label ?? roleId;
}

function roleSummary(roleId) {
  return DOVE_PRIMARY_ROLES.find((role) => role.id === roleId)?.summary ?? ROLE_HIERARCHY[roleId]?.charter ?? null;
}

function roleBoundaryCard(roleId, responseLanguage = "zh") {
  const role = ROLE_HIERARCHY[roleId];
  return {
    role: roleId,
    label: roleLabel(roleId),
    summary: roleSummary(roleId),
    boundary: role?.charter ?? roleSummary(roleId),
    manuallySwitchable: role?.manuallySwitchable === true,
    subagents: normalizeStringArray(role?.subagents)
  };
}

function normalizeWorkflowStage(stage, surface = "dove.status") {
  const normalized = normalizeString(stage, null)?.toLowerCase().replace(/_/g, "-") ?? null;
  if (["plan", "goal", "design", "checklist"].includes(normalized)) {
    return "plan";
  }
  if (["execute", "execution", "draft", "experiments", "source", "sources", "notes", "figure", "figures", "claim", "claims"].includes(normalized)) {
    return "execute";
  }
  if (["audit", "review"].includes(normalized)) {
    return "audit";
  }
  if (normalized === "return") {
    return "return";
  }
  if (["dove.auto", "dove.figure", "dove.experience", "dove.draft", "dove.source", "dove.note", "dove.document", "dove.documents", "dove.claim"].includes(surface)) {
    return "execute";
  }
  if (["dove.review", "dove.audit", "dove.paper-audit", "dove.audio-review", "dove.isolated-review"].includes(surface)) {
    return "audit";
  }
  return ["dove.status", "dove.mission", "dove.operator"].includes(surface) ? "plan" : null;
}

function surfaceIn(surface, needles) {
  return needles.some((needle) => surface === needle || surface.includes(needle));
}

export function inferPrimaryRoleForSurface(surface, context = {}) {
  const normalizedSurface = normalizeSurface(surface);
  const explicitRole = normalizeRoleId(context.roleId ?? context.primaryRole ?? context.currentContext?.primaryRole ?? context.packet?.ownerRole ?? context.packet?.nextRole);
  if (explicitRole && PRIMARY_ROLE_IDS.includes(explicitRole)) {
    return explicitRole;
  }
  const stage = normalizeWorkflowStage(context.stage ?? context.currentContext?.stage ?? context.packet?.stage, normalizedSurface);
  if (stage === "audit") {
    return "reviewer";
  }
  if (stage === "execute") {
    return "builder";
  }
  if (surfaceIn(normalizedSurface, ["review", "audit"])) {
    return "reviewer";
  }
  if (surfaceIn(normalizedSurface, ["auto", "figure", "experience", "draft", "source", "note", "document", "claim", "experiment", "rebuttal"])) {
    return "builder";
  }
  return "planner";
}

export function inferSubagentSpecialty(surface, context = {}) {
  const explicit = canonicalSubagentId(context.subagentSpecialty ?? context.specialty ?? context.roleId ?? context.packet?.ownerRole ?? context.packet?.nextRole);
  if (explicit) {
    return explicit;
  }
  const normalizedSurface = normalizeSurface(surface);
  if (surfaceIn(normalizedSurface, ["source", "note", "claim", "draft"])) {
    return "researcher";
  }
  if (surfaceIn(normalizedSurface, ["experience", "experiment"])) {
    return context.stage === "audit" ? null : "experiment-planner";
  }
  if (surfaceIn(normalizedSurface, ["rebuttal", "revision"])) {
    return "revision-lead";
  }
  if (surfaceIn(normalizedSurface, ["version"])) {
    return "version-analyst";
  }
  return null;
}

function interpretedIntentForSurface(surface, context = {}, responseLanguage = "zh") {
  const request = normalizeString(context.request, null);
  if (request) {
    return text(responseLanguage, `把普通 prompt “${request}” 先解释成 Dove 当前项目状态、角色边界和下一步工作流。`, `Interpret the ordinary prompt “${request}” as Dove project state, role boundary, and next workflow route first.`);
  }
  if (surface === "dove.status") {
    return text(responseLanguage, "先读取项目状况主页，再决定 planner/builder/reviewer 的下一步。", "Read the project situation home first, then decide the planner/builder/reviewer next step.");
  }
  if (surface === "dove.mission") {
    return text(responseLanguage, "把用户需求转成 durable work contract，而不是把 mission 当作列表或主界面。", "Convert the user demand into a durable work contract, not a mission list or primary UI.");
  }
  if (surface === "dove.auto") {
    return text(responseLanguage, "在显式确认后运行有界前台执行，并在边界处停止返回结果。", "After explicit confirmation, run bounded foreground work and stop at boundaries with a returned result.");
  }
  if (surface === "dove.operator") {
    return text(responseLanguage, "由 planner 协调 ready/blocked work，并只执行显式确认的一次前台 pass。", "Let the planner coordinate ready/blocked work and run only one explicitly confirmed foreground pass.");
  }
  if (surface === "dove.source") {
    return text(responseLanguage, "把已验证外部链接、模板、指南、venue/ranking 证据先注册为 packet-bound sources；未抓取或未注册的候选链接只能列为 candidate links，再进入 note 或 document evidence 综合沉淀。", "Register verified external links, templates, guidelines, and venue/ranking evidence as packet-bound sources first; unfetched or unregistered URLs stay as candidate links before synthesis through note or document evidence.");
  }
  if (surface === "dove.note") {
    return text(responseLanguage, "已有 summary、quote、claim 或 open question 时，直接把已注册 sources 综合成绑定主任务的结构化 note；内部压力测试总结和写作偏好不要伪装成 external source。", "When a summary, quote, claim, or open question is present, directly synthesize registered sources into a packet-bound structured note; internal pressure-test summaries and writing preferences must not be disguised as external sources.");
  }
  if (surface === "dove.draft") {
    return text(responseLanguage, "已有正文时，直接记录 packet-bound draft body；缺正文时停下要求 draft content，不创建占位草稿。", "When body content is present, directly record a packet-bound draft body; when body content is missing, stop for draft content instead of creating a placeholder draft.");
  }
  if (surface === "dove.document" || surface === "dove.documents") {
    return text(responseLanguage, "已有报告或产物摘要/路径时，直接作为 document evidence 绑定到 durable packet，并保留 source/artifact provenance。", "When a report or output summary/path is present, directly bind it as document evidence to a durable packet while preserving source/artifact provenance.");
  }
  return text(responseLanguage, "先用三角色和 lesson guardrail 框住行动，再进入具体 Dove workflow。", "Frame the action with the three roles and lesson guardrails before entering the concrete Dove workflow.");
}

export function buildIntentFrame(surface, context = {}, responseLanguage = "zh") {
  const normalizedSurface = normalizeSurface(surface);
  return {
    ordinaryPromptFirst: true,
    interpretedIntent: interpretedIntentForSurface(normalizedSurface, context, responseLanguage),
    primaryEntry: "statusHome",
    missionAsWorkContract: true,
    noDedicatedMissionListCommand: true,
    statusAsCommandCenter: true,
    surface: normalizedSurface
  };
}

function commandFromNextAction(nextAction) {
  if (!nextAction) {
    return null;
  }
  if (typeof nextAction === "string") {
    return nextAction;
  }
  return normalizeString(nextAction.command ?? nextAction.firstAction ?? nextAction.copyableCommand ?? nextAction.nextAction, null);
}

function titleFromNextAction(nextAction) {
  if (!nextAction) {
    return null;
  }
  if (typeof nextAction === "string") {
    return nextAction;
  }
  return normalizeString(nextAction.title ?? nextAction.why ?? nextAction.command ?? nextAction.firstAction, null);
}

function workflowRouteForSurface(surface, command, responseLanguage = "zh") {
  if (command) {
    return command;
  }
  const route = {
    "dove.status": "query_dove_status",
    "dove.mission": "create_dove_task proposal -> materialized contract -> recommended handoff",
    "dove.auto": "run_dove_auto preview -> confirmed bounded foreground pass",
    "dove.operator": "run_dove_operator preview -> confirmed queue pass",
    "dove.review": "review/audit workflow with independent reviewer boundary",
    "dove.source": "register_source quick path for verified external provenance, keep candidate links separate, optionally batch -> upsert_note or record_document_evidence synthesis",
    "dove.note": "upsert_note quick path for packet-bound synthesis from registered sources -> claims or document evidence",
    "dove.draft": "upsert_draft quick path for an existing packet-bound draft body -> run_review_loop independent review",
    "dove.document": "record_document_evidence quick path for packet-bound report/archive ledger with source and artifact provenance",
    "dove.documents": "record_document_evidence quick path for packet-bound report/archive ledger with source and artifact provenance",
    "dove.figure": "figure materials -> generation/import -> caption/provenance -> QA",
    "dove.experience": "experiment plan/result -> audit -> claim bridge",
    "dove.rebuttal": "review issue board -> builder revision strategy -> response draft"
  }[surface];
  return route ?? text(responseLanguage, "先 statusHome 分诊，再进入对应 Dove workflow。", "Triage through statusHome first, then enter the matching Dove workflow.");
}

function foregroundFlowForSurface(surface, responseLanguage = "zh") {
  if (surface === "dove.status") {
    return text(responseLanguage, "只读 command-center 查询；不写入、不刷新、不执行命令。", "Read-only command-center query; no writes, refresh, or command execution.");
  }
  if (surface === "dove.mission") {
    return text(responseLanguage, "先 proposal card，确认后只物化任务合同并交接推荐路线；mission 本身不执行 pass。", "Show a proposal card first; after confirmation only materialize the task contract and hand off recommended routes; mission itself does not run a pass.");
  }
  if (surface === "dove.auto") {
    return text(responseLanguage, "显式确认后的 bounded foreground loop；到证据、边界或预算即停。", "Explicitly confirmed bounded foreground loop; stop at evidence, boundary, or budget.");
  }
  if (surface === "dove.operator") {
    return text(responseLanguage, "显式确认的一次队列协调 pass；不启动 scheduler 或 daemon。", "One explicitly confirmed queue coordination pass; no scheduler or daemon.");
  }
  return text(responseLanguage, "显式工具调用内完成当前 workflow 阶段；写入必须经过该工具的确认契约。", "Complete the current workflow stage inside an explicit tool call; writes must follow that tool's confirmation contract.");
}

function gatesForSurface(surface, primaryRole, responseLanguage = "zh") {
  const common = [
    text(responseLanguage, "先读取自动召回的 lessons，只作为 guardrail。", "Read automatically recalled lessons first as guardrails only."),
    text(responseLanguage, "写入、执行、状态调整都必须显式确认。", "Writes, execution, and status changes require explicit confirmation."),
    text(responseLanguage, "不能启动隐藏后台 runtime。", "Do not start hidden background runtime.")
  ];
  if (primaryRole === "reviewer") {
    return [
      text(responseLanguage, "Reviewer 必须独立审查证据，不能替 builder 自证完整性。", "Reviewer must independently audit evidence and cannot self-certify builder completeness."),
      ...common
    ];
  }
  if (primaryRole === "builder") {
    return [
      text(responseLanguage, "Builder 产出必须带 evidence/provenance，返回后交 reviewer 或 status gate。", "Builder output must carry evidence/provenance and return through reviewer or status gates."),
      ...common
    ];
  }
  return [
    text(responseLanguage, "Planner 先定范围、优先级、下一条 workflow route，不直接伪装成执行结果。", "Planner sets scope, priority, and the next workflow route first, without pretending execution happened."),
    ...common
  ];
}

function stopConditionsForSurface(surface, responseLanguage = "zh") {
  if (surface === "dove.status") {
    return [text(responseLanguage, "返回项目状况、角色路由、lesson guardrails 和下一步；不执行下一步。", "Return project state, role route, lesson guardrails, and next step; do not execute it.")];
  }
  return [
    text(responseLanguage, "遇到缺输入、缺证据、权限边界、review gate 或预算耗尽时停止。", "Stop on missing input, missing evidence, authority boundary, review gate, or budget exhaustion."),
    text(responseLanguage, "返回 result card / handoff / next action，而不是继续隐藏运行。", "Return a result card, handoff, or next action instead of continuing hidden work.")
  ];
}

function executionGuidanceStopCondition({ readiness, coverage, statusExecutionGaps }, responseLanguage = "zh") {
  if (readiness && !readiness.ready) {
    return text(responseLanguage, "缺可执行合同时停止在 Planner，不进入 Builder 或 completion。", "Stop at Planner when the executable contract is missing; do not enter Builder or completion.");
  }
  if (normalizeStringArray(statusExecutionGaps?.missingMaterialTaskIds).length > 0) {
    return text(responseLanguage, "缺 source/material/read-first 输入时停止并要求补材料。", "Stop and require materials when source/material/read-first inputs are missing.");
  }
  if (coverage && coverage.complete === false) {
    return text(responseLanguage, "convergence.criteria 未覆盖时停止在 verification/reviewer gate。", "Stop at the verification/reviewer gate when convergence.criteria are not covered.");
  }
  if (normalizeStringArray(statusExecutionGaps?.verificationGapTaskIds).length > 0) {
    return text(responseLanguage, "已有结果但缺 verifiedCriteria 时停止在 Reviewer 验证。", "Stop at Reviewer verification when results exist but verifiedCriteria is missing.");
  }
  return text(responseLanguage, "下一步只能执行当前显式前台 pass，并返回证据或边界。", "Run only the current explicit foreground pass next, returning evidence or a boundary.");
}

function buildExecutionGuidance(context = {}, primaryRole = "planner", responseLanguage = "zh") {
  const packet = normalizeObject(context.packet);
  const statusExecutionGaps = normalizeObject(context.statusSummary?.executionGaps);
  const hasPacket = Boolean(packet.id ?? packet.packetId ?? packet.taskPacketId);
  const contract = hasPacket ? normalizeDoveExecutionContract(packet.executionContract, null) : null;
  const readiness = hasPacket ? doveExecutionContractReadiness(contract) : null;
  const verifiedCriteria = hasPacket ? normalizeDoveVerifiedCriteria(packet.verifiedCriteria) : [];
  const coverage = hasPacket ? doveExecutionCriteriaCoverage(contract, verifiedCriteria) : null;
  const missingContractTaskIds = normalizeStringArray(statusExecutionGaps.missingContractTaskIds);
  const missingMaterialTaskIds = normalizeStringArray(statusExecutionGaps.missingMaterialTaskIds);
  const verificationGapTaskIds = normalizeStringArray(statusExecutionGaps.verificationGapTaskIds);
  const readyBuilderTaskIds = normalizeStringArray(statusExecutionGaps.readyBuilderTaskIds);
  const nextRole = !hasPacket && missingContractTaskIds.length > 0
    ? "planner"
    : readiness && !readiness.ready
      ? "planner"
      : missingMaterialTaskIds.length > 0
        ? "planner"
        : (coverage?.complete === false || verificationGapTaskIds.length > 0)
          ? "reviewer"
          : readyBuilderTaskIds.length > 0
            ? "builder"
            : primaryRole;
  return {
    executableContractPresent: hasPacket ? Boolean(contract) : missingContractTaskIds.length === 0 ? null : false,
    executableContractReady: hasPacket ? readiness?.ready === true : null,
    executionContractStatus: hasPacket ? readiness?.status ?? null : null,
    missingContractFields: hasPacket ? normalizeStringArray(readiness?.missing) : [],
    missingContractTaskIds,
    missingMaterialTaskIds,
    verificationGapTaskIds,
    readyBuilderTaskIds,
    requiredMaterials: hasPacket ? normalizeStringArray(readiness?.requiredMaterials) : normalizeStringArray(statusExecutionGaps.requiredMaterials),
    evidenceRequired: hasPacket ? normalizeStringArray(readiness?.evidenceRequired) : normalizeStringArray(statusExecutionGaps.evidenceRequired),
    criteriaCoverage: coverage ? {
      complete: Boolean(coverage.complete),
      missing: normalizeStringArray(coverage.missing),
      requiredCount: normalizeStringArray(coverage.required).length
    } : null,
    nextRole,
    stopCondition: executionGuidanceStopCondition({ readiness, coverage, statusExecutionGaps }, responseLanguage)
  };
}

export function buildWorkflowFrame(surface, context = {}, responseLanguage = "zh") {
  const normalizedSurface = normalizeSurface(surface);
  const currentStage = normalizeWorkflowStage(context.stage ?? context.currentContext?.stage ?? context.packet?.stage, normalizedSurface);
  const command = commandFromNextAction(context.nextAction ?? context.routeHint);
  const nextHumanAction = normalizeString(context.nextHumanAction, null) ?? titleFromNextAction(context.nextAction) ?? command ?? workflowRouteForSurface(normalizedSurface, null, responseLanguage);
  const primaryRole = inferPrimaryRoleForSurface(normalizedSurface, context);
  const executionGuidance = buildExecutionGuidance(context, primaryRole, responseLanguage);
  return {
    currentStage,
    recommendedRoute: workflowRouteForSurface(normalizedSurface, command, responseLanguage),
    nextHumanAction,
    allowedForegroundFlow: foregroundFlowForSurface(normalizedSurface, responseLanguage),
    executionGuidance,
    gates: gatesForSurface(normalizedSurface, primaryRole, responseLanguage),
    stopConditions: [executionGuidance.stopCondition, ...stopConditionsForSurface(normalizedSurface, responseLanguage)]
  };
}

function lessonUpdatedAt(lesson = {}) {
  return String(lesson.updatedAt ?? lesson.createdAt ?? "");
}

function lessonRoleMatches(lessonRole, primaryRole) {
  const normalized = normalizeString(lessonRole, null);
  if (!normalized || !primaryRole) {
    return false;
  }
  if (normalized === primaryRole) {
    return true;
  }
  return ROLE_HIERARCHY[normalized]?.parentRole === primaryRole;
}

function scoreLesson(lesson = {}, context = {}) {
  const matchedBecause = [];
  let score = 0;
  const packet = context.packet && typeof context.packet === "object" ? context.packet : {};
  const packetIds = normalizeStringArray(lesson.packetIds);
  const linkedPacketIds = normalizeStringArray([context.packetId, context.taskPacketId, packet.id, packet.packetId, packet.taskPacketId]);
  const linkedLessonIds = new Set(normalizeStringArray(packet.lessonIds));
  const primaryRole = inferPrimaryRoleForSurface(context.surface ?? "dove.status", context);
  if (packetIds.some((packetId) => linkedPacketIds.includes(packetId))) {
    score += 100;
    matchedBecause.push("packet");
  }
  if (linkedLessonIds.has(lesson.id)) {
    score += 90;
    matchedBecause.push("packet-lesson-id");
  }
  if (lessonRoleMatches(lesson.actorRole ?? lesson.roleId, primaryRole)) {
    score += 40;
    matchedBecause.push("role");
  }
  const domain = normalizeString(context.domain ?? context.currentContext?.domain ?? packet.domain ?? packet.doveDomain, null);
  if (domain && lesson.domain === domain) {
    score += 25;
    matchedBecause.push("domain");
  }
  const stage = normalizeWorkflowStage(context.stage ?? context.currentContext?.stage ?? packet.stage, context.surface ?? "dove.status");
  if (stage && normalizeWorkflowStage(lesson.stage, context.surface ?? "dove.status") === stage) {
    score += 20;
    matchedBecause.push("stage");
  }
  const contextTags = new Set(normalizeStringArray([context.workflowKind, context.surface, context.domain, context.stage, ...(Array.isArray(context.tags) ? context.tags : [])]));
  const tagMatches = normalizeStringArray(lesson.tags).filter((tag) => contextTags.has(tag));
  if (tagMatches.length > 0) {
    score += tagMatches.length * 8;
    matchedBecause.push(...tagMatches.map((tag) => `tag:${tag}`));
  }
  if (packetIds.length === 0) {
    score += 5;
    matchedBecause.push("global");
  }
  if (score === 0) {
    score = 1;
    matchedBecause.push("active");
  }
  return { score, matchedBecause: Array.from(new Set(matchedBecause)) };
}

export function compactPreActionLesson(lesson = {}, matchInfo = {}) {
  const nextTimeCount = normalizeStringArray(lesson.nextTime).length;
  return {
    id: lesson.id,
    title: lesson.title,
    matchedBecause: normalizeStringArray(matchInfo.matchedBecause),
    mustObey: lesson.mustObey ?? true,
    nextTimeCount,
    hasNextTimeGuidance: nextTimeCount > 0,
    role: lesson.actorRole ?? null,
    domain: lesson.domain ?? null,
    stage: lesson.stage ?? null,
    tags: normalizeStringArray(lesson.tags).slice(0, 5)
  };
}

export function selectPreActionLessons(operatorLessons = {}, context = {}) {
  const lessons = Array.isArray(operatorLessons) ? operatorLessons : normalizeObjectArray(operatorLessons.lessons);
  const limit = Math.min(FULL_LESSON_LIMIT, Math.max(0, Number.isFinite(context.lessonLimit) ? Math.floor(context.lessonLimit) : DEFAULT_LESSON_LIMIT));
  return lessons
    .filter((lesson) => String(lesson.status ?? "active").trim().toLowerCase() === "active")
    .map((lesson) => ({ lesson, matchInfo: scoreLesson(lesson, context) }))
    .sort((left, right) => right.matchInfo.score - left.matchInfo.score || lessonUpdatedAt(right.lesson).localeCompare(lessonUpdatedAt(left.lesson)) || String(left.lesson.id ?? "").localeCompare(String(right.lesson.id ?? "")))
    .slice(0, limit)
    .map(({ lesson, matchInfo }) => compactPreActionLesson(lesson, matchInfo));
}

function buildRoleFrame(surface, context = {}, responseLanguage = "zh") {
  const primaryRole = inferPrimaryRoleForSurface(surface, context);
  return {
    primaryRole,
    primaryRoleLabel: roleLabel(primaryRole),
    roleReason: text(responseLanguage, `${roleLabel(primaryRole)} 是当前入口的主角色；specialty 只作为该主角色下的自动子能力。`, `${roleLabel(primaryRole)} is the primary role for this surface; specialties stay as automatic sub-capabilities under it.`),
    subagentSpecialty: inferSubagentSpecialty(surface, context),
    roleBoundaries: PRIMARY_ROLE_IDS.map((roleId) => roleBoundaryCard(roleId, responseLanguage))
  };
}

export function buildPreActionGuidance({
  surface = "dove.status",
  responseLanguage = "zh",
  request = null,
  roleId = null,
  packet = null,
  currentContext = {},
  operatorLessons = {},
  nextAction = null,
  routeHint = null,
  workflowKind = null,
  domain = null,
  stage = null,
  statusSummary = null,
  lessonLimit = DEFAULT_LESSON_LIMIT,
  subagentSpecialty = null,
  nextHumanAction = null,
  tags = []
} = {}) {
  const normalizedSurface = normalizeSurface(surface);
  const context = {
    surface: normalizedSurface,
    responseLanguage,
    request,
    roleId: roleId ?? currentContext?.primaryRole ?? packet?.ownerRole ?? packet?.nextRole,
    packet,
    currentContext,
    nextAction,
    routeHint,
    workflowKind,
    domain: domain ?? currentContext?.domain ?? packet?.domain ?? packet?.doveDomain,
    stage: stage ?? currentContext?.stage ?? packet?.stage,
    statusSummary,
    lessonLimit,
    subagentSpecialty,
    nextHumanAction,
    tags
  };
  const roleFrame = buildRoleFrame(normalizedSurface, context, responseLanguage);
  const workflowFrame = buildWorkflowFrame(normalizedSurface, context, responseLanguage);
  return {
    version: 1,
    presentation: "dove-pre-action-guidance",
    surface: normalizedSurface,
    mode: "read-only-guidance",
    intentFrame: buildIntentFrame(normalizedSurface, context, responseLanguage),
    roleFrame,
    workflowFrame,
    lessonRecall: {
      automatic: true,
      readOnly: true,
      recordingExplicitOnly: true,
      lessonsPath: ARTIFACT_PATHS.metaOperatorLessons,
      topLessons: selectPreActionLessons(operatorLessons, { ...context, roleId: roleFrame.primaryRole })
    },
    referencePatterns: {
      learnedFrom: ["ARIS", "Trellis", "CodeStable", "oh-my-openagent", "AutoFigure-edit"],
      appliedPatterns: ["intent-gate", "stage-gates", "knowledge-compounding", "primary-role-routing", "artifact-provenance"]
    },
    guardrails: {
      explicitOnly: true,
      noHiddenRuntime: true,
      noAutoApply: true,
      requiresConfirmationForWrites: true,
      boundedForegroundOnly: true
    }
  };
}

export function summarizePreActionGuidance(guidance = {}) {
  const topLessons = normalizeObjectArray(guidance.lessonRecall?.topLessons);
  return {
    presentation: "dove-pre-action-guidance-summary",
    surface: guidance.surface ?? null,
    primaryRole: guidance.roleFrame?.primaryRole ?? null,
    primaryRoleLabel: guidance.roleFrame?.primaryRoleLabel ?? null,
    subagentSpecialty: guidance.roleFrame?.subagentSpecialty ?? null,
    nextHumanAction: guidance.workflowFrame?.nextHumanAction ?? null,
    executionNextRole: guidance.workflowFrame?.executionGuidance?.nextRole ?? null,
    executableContractReady: guidance.workflowFrame?.executionGuidance?.executableContractReady ?? null,
    stopCondition: guidance.workflowFrame?.executionGuidance?.stopCondition ?? null,
    lessonIds: topLessons.map((lesson) => lesson.id).filter(Boolean),
    noHiddenRuntime: guidance.guardrails?.noHiddenRuntime === true,
    requiresConfirmationForWrites: guidance.guardrails?.requiresConfirmationForWrites === true,
    recordingExplicitOnly: guidance.lessonRecall?.recordingExplicitOnly === true
  };
}
