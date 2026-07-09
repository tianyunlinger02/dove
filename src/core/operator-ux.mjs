function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeString(value, fallback = null) {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.map((value) => normalizeString(value)).filter(Boolean);
}

function uniqueStrings(values) {
  return [...new Set(normalizeStringArray(values))];
}

function compactObject(fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => {
    if (value === null || value === undefined) {
      return false;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (isPlainObject(value)) {
      return Object.keys(value).length > 0;
    }
    return true;
  }));
}

function text(responseLanguage, zh, en) {
  return responseLanguage === "en" ? en : zh;
}

function firstString(...values) {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function responseLanguageFrom(data, fallback = "zh") {
  return normalizeString(data?.responseLanguage ?? data?.statusHome?.responseLanguage, fallback) === "en" ? "en" : "zh";
}

const codeUx = {
  "source-requires-host-provenance": {
    blockedSummary: ["现在卡在：需要你提供真实来源 URL 或可验证来源信息。", "Blocked: provide a real source URL or verifiable source information."],
    cannotContinueBecause: ["没有可验证 source，Dove 不能把候选链接当成 provenance。", "There is no verifiable source, so Dove cannot treat candidate links as provenance."],
    nextOperatorAction: ["提供 URL、标题和 locator，或先运行授权检索后再登记 source。", "Provide a URL, title, and locator, or run authorized retrieval before registering the source."],
    requiredEvidence: [["真实来源 URL", "来源标题", "locator 或可访问出处"], ["real source URL", "source title", "locator or accessible origin"]]
  },
  "source-provenance-unverified": {
    blockedSummary: ["现在卡在：需要可验证 source。", "Blocked: a verifiable source is required."],
    cannotContinueBecause: ["检索失败、0 结果或被安全策略阻断不能登记为 source provenance。", "Failed retrieval, zero results, or safety blocks cannot be registered as source provenance."],
    nextOperatorAction: ["补充已访问过的来源材料，或授权主机侧重新检索。", "Provide already-accessed source material, or authorize host-side retrieval again."],
    requiredEvidence: [["可访问 URL", "来源标题", "检索/访问证据"], ["accessible URL", "source title", "retrieval/access evidence"]]
  },
  "collect-source-provenance": {
    blockedSummary: ["现在卡在：需要收集真实来源证据。", "Blocked: collect real source evidence."],
    cannotContinueBecause: ["缺少 source provenance。", "Source provenance is missing."],
    nextOperatorAction: ["补 URL、标题、作者/年份或 locator，然后再调用 source 登记。", "Add URL, title, authors/year, or locator, then register the source."],
    requiredEvidence: [["source provenance"], ["source provenance"]]
  },
  "provide-explicit-auto-step": {
    blockedSummary: ["现在卡在：需要明确的下一步执行内容。", "Blocked: an explicit next execution step is required."],
    cannotContinueBecause: ["只读查询或空步骤不能推进 durable task。", "Read-only queries or empty steps cannot advance a durable task."],
    nextOperatorAction: ["提供具体写入、生成、review 或 evidence step。", "Provide a concrete write, generation, review, or evidence step."],
    requiredEvidence: [["明确 auto step", "执行证据"], ["explicit auto step", "execution evidence"]]
  },
  "note-requires-host-synthesis": {
    blockedSummary: ["现在卡在：需要你提供 note 的真实综合内容。", "Blocked: provide real note synthesis content."],
    cannotContinueBecause: ["空 note 不能作为研究进展写入。", "An empty note cannot be written as research progress."],
    nextOperatorAction: ["提供 summary、quote、claim 或 open question。", "Provide a summary, quote, claim, or open question."],
    requiredEvidence: [["note summary/claim/quote"], ["note summary/claim/quote"]]
  },
  "draft-requires-host-content": {
    blockedSummary: ["现在卡在：需要真实 draft body。", "Blocked: a real draft body is required."],
    cannotContinueBecause: ["没有正文内容时不能写 draft。", "A draft cannot be written without body content."],
    nextOperatorAction: ["提供 sectionId 和 draft body，或只更新状态时改用 section status。", "Provide sectionId and draft body, or use section status for metadata-only updates."],
    requiredEvidence: [["draft body", "sectionId"], ["draft body", "sectionId"]]
  },
  "experience-requires-host-objective": {
    blockedSummary: ["现在卡在：需要实验目标或已有 experimentId。", "Blocked: an experiment goal or existing experimentId is required."],
    cannotContinueBecause: ["没有实验目标时不能规划或记录 experiment。", "An experiment cannot be planned or recorded without an objective."],
    nextOperatorAction: ["提供 goal/title/idea/experimentId 和成功指标。", "Provide a goal/title/idea/experimentId and success metric."],
    requiredEvidence: [["实验目标", "成功指标"], ["experiment objective", "success metric"]]
  },
  "review-loop-requires-host-material": {
    blockedSummary: ["现在卡在：需要 review-loop 材料。", "Blocked: review-loop material is required."],
    cannotContinueBecause: ["缺少 draft 内容或 experiment 目标。", "Draft content or an experiment objective is missing."],
    nextOperatorAction: ["提供 draft body 或 experience goal 后再运行 review-loop。", "Provide a draft body or experience goal before running the review loop."],
    requiredEvidence: [["draft body 或 experience goal"], ["draft body or experience goal"]]
  },
  "awaiting-host-pass-result": {
    blockedSummary: ["现在卡在：需要真实证据或执行结果。", "Blocked: real evidence or execution results are required."],
    cannotContinueBecause: ["Dove 不会假装外部检索、生成或验证已经完成。", "Dove will not pretend external retrieval, generation, or verification has completed."],
    nextOperatorAction: ["补充真实执行结果、证据出处或失败原因。", "Provide real execution results, evidence references, or the failure reason."],
    requiredEvidence: [["真实执行结果", "证据出处"], ["real execution result", "evidence reference"]]
  },
  "host-tool-blocked": {
    blockedSummary: ["现在卡在：工具或权限阻止继续。", "Blocked: a tool or permission issue prevents progress."],
    cannotContinueBecause: ["需要补执行结果，或先让相关工具可用。", "Provide execution results, or make the needed tool available first."],
    nextOperatorAction: ["补真实结果/证据，或修复工具权限后重试。", "Provide real results/evidence, or fix tool permissions and retry."],
    requiredEvidence: [["真实执行结果", "失败日志或证据出处"], ["real execution result", "failure log or evidence reference"]]
  },
  "awaiting-provider-output": {
    blockedSummary: ["现在卡在：等待生成结果。", "Blocked: generation output is still missing."],
    cannotContinueBecause: ["缺少生成结果，或生成所需配置还不可用。", "Generation output is missing, or the required generation setup is unavailable."],
    nextOperatorAction: ["提供生成结果，或配置环境变量后显式重试。", "Provide the generation output, or configure environment variables and retry explicitly."],
    requiredEvidence: [["生成结果", "生成记录"], ["generation output", "generation record"]]
  },
  "awaiting-review-output": {
    blockedSummary: ["现在卡在：等待独立 review 结果。", "Blocked: waiting for independent review results."],
    cannotContinueBecause: ["缺少 reviewer 输出或报告。", "Reviewer output or report is missing."],
    nextOperatorAction: ["导入 reviewer 输出/报告，或重新准备 review 材料。", "Import reviewer output/report, or prepare the review materials again."],
    requiredEvidence: [["reviewer 输出", "review report"], ["reviewer output", "review report"]]
  },
  "missing-required-materials": {
    blockedSummary: ["现在卡在：缺少必需材料。", "Blocked: required materials are missing."],
    cannotContinueBecause: ["材料不足时继续会产生不可验证输出。", "Continuing without materials would produce unverifiable output."],
    nextOperatorAction: ["补齐 requiredInputs/requiredMaterials 后再继续。", "Provide requiredInputs/requiredMaterials before continuing."],
    requiredEvidence: [["必需输入材料"], ["required input materials"]]
  },
  "verification-failed": {
    blockedSummary: ["现在卡在：验证未通过。", "Blocked: verification failed."],
    cannotContinueBecause: ["完成标准还没有被证据覆盖。", "Done criteria are not covered by evidence yet."],
    nextOperatorAction: ["补验证证据或修复失败项后重新 review。", "Provide verification evidence or fix failed items before review."],
    requiredEvidence: [["验证证据", "失败项修复记录"], ["verification evidence", "fix record"]]
  }
};

function localizedEntry(entry, responseLanguage, key) {
  if (!entry?.[key]) {
    return null;
  }
  const value = entry[key];
  if (Array.isArray(value) && Array.isArray(value[0])) {
    return responseLanguage === "en" ? value[1] : value[0];
  }
  if (Array.isArray(value)) {
    return responseLanguage === "en" ? value[1] : value[0];
  }
  return value;
}

export function collectOperatorCodes(data) {
  if (!isPlainObject(data)) {
    return [];
  }
  const resultCardAction = Array.isArray(data.resultCard?.nextActions) ? data.resultCard.nextActions[0] : null;
  return uniqueStrings([
    data.status,
    data.kind,
    data.outcome,
    data.stopReason,
    data.reason,
    data.boundaryType,
    data.boundary?.type,
    data.boundary?.reason,
    data.resultCard?.kind,
    data.resultCard?.outcome,
    data.resultCard?.stopReason,
    data.resultCard?.boundaryType,
    data.resultCard?.boundary?.type,
    data.resultCard?.boundary?.reason,
    resultCardAction?.kind,
    resultCardAction?.boundaryType,
    resultCardAction?.reason,
    ...normalizeStringArray(data.requiredActions),
    ...normalizeStringArray(data.boundary?.requiredActions),
    ...normalizeStringArray(data.resultCard?.requiredActions),
    ...normalizeStringArray(data.resultCard?.boundary?.requiredActions),
    ...normalizeStringArray(resultCardAction?.requiredActions)
  ]);
}

export function buildOperatorUnblock(data, responseLanguage = responseLanguageFrom(data)) {
  const codes = collectOperatorCodes(data);
  const matchedCode = codes.find((code) => codeUx[code]);
  const entry = matchedCode ? codeUx[matchedCode] : null;
  const boundaryType = firstString(data?.boundaryType, data?.boundary?.type, data?.resultCard?.boundaryType, data?.resultCard?.boundary?.type);
  if (!entry && !boundaryType) {
    return null;
  }
  const blockedSummary = localizedEntry(entry, responseLanguage, "blockedSummary")
    ?? text(responseLanguage, "当前没有明确的人为阻塞；如需细节请展开 full/debug。", "There is no explicit operator block; expand full/debug for details.");
  const cannotContinueBecause = localizedEntry(entry, responseLanguage, "cannotContinueBecause");
  const nextOperatorAction = localizedEntry(entry, responseLanguage, "nextOperatorAction")
    ?? firstString(data?.nextAction, data?.nextCommand, data?.boundary?.command);
  const requiredEvidence = uniqueStrings([
    ...(localizedEntry(entry, responseLanguage, "requiredEvidence") ?? []),
    ...normalizeStringArray(data?.requiredEvidence),
    ...normalizeStringArray(data?.boundary?.requiredInputs)
  ]).slice(0, 8);
  return compactObject({
    summary: blockedSummary,
    why: cannotContinueBecause,
    operatorAction: nextOperatorAction,
    needs: requiredEvidence,
    blockedSummary,
    cannotContinueBecause,
    nextOperatorAction,
    requiredEvidence,
    boundaryType
  });
}

const routeByTool = {
  query_dove_status: ["read-only-query", "query_dove_status", "读取项目当前情况，不写入。", "Read the current project situation without writing."],
  query_dove_orchestrate: ["read-only-routing", "query_dove_orchestrate", "把自然语言意图路由到下一步 Dove 工具。", "Route a natural-language intent to the next Dove tool."],
  query_document_ledger: ["read-only-query", "query_document_ledger", "查看已登记 evidence/document ledger。", "Inspect registered evidence/document ledger entries."],
  query_operator_lessons: ["read-only-query", "query_operator_lessons", "查看显式沉淀的 operator lessons。", "Inspect explicitly recorded operator lessons."],
  create_dove_task: ["mission-contract", "create_dove_task", "把较大或模糊请求变成可确认的 mission contract 并交接后续流程。", "Turn a larger or ambiguous request into a confirmable mission contract and hand off the next workflow."],
  run_dove_auto: ["bounded-auto-loop", "run_dove_auto", "确认后运行有预算的前台多步推进。", "Run a confirmed bounded foreground multi-step pass."],
  run_dove_operator: ["operator-queue-pass", "run_dove_operator", "确认后协调 ready/in-progress 队列。", "Coordinate ready/in-progress queue items after confirmation."],
  register_source: ["quick-path", "register_source", "已有可验证来源时，直接登记 source provenance。", "Register source provenance directly when verifiable source material is present."],
  upsert_note: ["quick-path", "upsert_note", "已有综合内容时，直接记录结构化 note。", "Record a structured note directly when synthesis content is present."],
  upsert_draft: ["quick-path", "upsert_draft", "已有正文时，直接写入 draft。", "Write a draft directly when body content is present."],
  record_document_evidence: ["quick-path", "record_document_evidence", "已有 artifact/source refs 时，直接登记 document evidence。", "Record document evidence directly when artifact/source refs are explicit."],
  run_figure_workflow: ["workflow", "run_figure_workflow", "规划或生成 figure，并保留材料/QA 边界。", "Plan or generate a figure while preserving material/QA boundaries."],
  run_experience_workflow: ["workflow", "run_experience_workflow", "规划、记录、audit 并 bridge experiment。", "Plan, record, audit, and bridge an experiment."],
  run_review_loop: ["workflow", "run_review_loop", "运行证据感知 review 并生成 revision plan。", "Run evidence-aware review and produce a revision plan."],
  build_rebuttal_strategy: ["workflow", "build_rebuttal_strategy", "基于 normalized reviewer issues 生成 rebuttal strategy。", "Build a rebuttal strategy from normalized reviewer issues."],
  query_dove_return: ["read-only-verification", "query_dove_return", "检查 mission return readiness，不写入。", "Inspect mission return readiness without writing."]
};

function requiredFieldsForTool(tool) {
  if (["register_source", "upsert_note", "upsert_draft", "record_document_evidence"].includes(tool)) {
    return ["packetId/target", "真实内容或证据"];
  }
  if (["run_dove_auto", "run_dove_operator", "create_dove_task"].includes(tool)) {
    return ["confirm/confirmed", "目标或 packetId", "执行证据约束"];
  }
  if (tool === "query_dove_status") {
    return ["intent 可选：project-status / health-check / contract-test"];
  }
  return [];
}

export function buildOperatorRoute(tool, args = {}, data = {}, responseLanguage = responseLanguageFrom(data)) {
  const route = routeByTool[tool] ?? ["advanced", tool, "这是高级 Dove 工具；默认先从 query_dove_status 分诊。", "This is an advanced Dove tool; triage through query_dove_status first."];
  const requestedIntent = normalizeStatusIntent(args?.intent ?? data?.statusHome?.intent ?? data?.intent);
  return compactObject({
    presentation: "dove-operator-route-card",
    intent: tool === "query_dove_status" ? requestedIntent : null,
    routeType: route[0],
    recommendedTool: route[1],
    why: text(responseLanguage, route[2], route[3]),
    requiredFields: requiredFieldsForTool(tool),
    expansion: "resultMode: full/debug 或 tools/list surface: full/debug 可查看完整细节",
    plannerBuilderReviewer: text(responseLanguage, "Planner 定范围，Builder 做工作，Reviewer 独立验证；不是公开 slash 分层。", "Planner scopes, Builder executes, Reviewer verifies independently; these are not public slash tiers.")
  });
}

export function normalizeStatusIntent(value) {
  const normalized = normalizeString(value, "project-status").toLowerCase();
  return ["project-status", "health-check", "contract-test"].includes(normalized) ? normalized : "project-status";
}

export function buildContractHealth(data = {}, responseLanguage = responseLanguageFrom(data)) {
  return compactObject({
    presentation: "dove-contract-health",
    status: text(responseLanguage, "compact contract 可用", "compact contract available"),
    mcpCompactContract: true,
    operatorToolSurface: true,
    fullDebugExpansion: true,
    generatedAdapters: text(responseLanguage, "运行 commands:check 可验证", "run commands:check to verify"),
    commandValidation: text(responseLanguage, "运行 commands:validate 可验证", "run commands:validate to verify")
  });
}
