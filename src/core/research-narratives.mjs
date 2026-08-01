import { researchDecisionNarrativeDirective, validatePersistedResearchDecision } from "./research-decisions.mjs";

const NARRATIVE_FIELDS = new Set([
  "researchDirection",
  "currentUnderstanding",
  "evidence",
  "unknowns",
  "currentValueJudgment",
  "nextStep",
  "stopReason",
  "rejectedDirections",
  "applicableLessons"
]);
const REJECTED_DIRECTION_FIELDS = new Set(["direction", "reason"]);
const APPLICABLE_LESSON_FIELDS = new Set(["lesson", "application"]);
const BUILD_FROM_DECISION_OPTION_FIELDS = new Set(["awaitingReevaluation"]);
const RENDER_OPTION_FIELDS = new Set(["language"]);
const SUPPORTED_LANGUAGES = new Set(["zh", "en"]);
const FORBIDDEN_TEXT = [
  /\.dove(?:-archive)?(?:[\\/]|\b)/iu,
  /(?:^|\s)\/(?:[^\s/]+\/)+[^\s/]+/u,
  /\b[A-Za-z]:\\[^\s]+/u,
  /\b[0-9a-f]{32,128}\b/iu,
  /\b(?:schema|format)[-_ ]?version\b/iu,
  /\b(?:digest|fingerprint|proposal(?:version|workspace|digest|token)|confirmargs|exact[-_ ]?replay|mutationmode|host[-_ ]?control|resume[-_ ]?original|host[-_ ]?outcome|closure|retry|archiveTarget|resultMode|contractDigest|missionId|decisionId|actionId|lessonId)\b/iu
];

function assertPlainRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`${label} must be a plain object.`);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") throw new Error(`${label} does not accept symbol fields.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) throw new Error(`${label}.${key} must be an enumerable data field.`);
  }
}

function assertSealedRecord(value, fields, label) {
  assertPlainRecord(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}

function assertJsonArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const unexpected = Reflect.ownKeys(value).filter((key) => typeof key !== "string" || (key !== "length" && !/^(?:0|[1-9][0-9]*)$/u.test(key)));
  if (unexpected.length > 0) throw new Error(`${label} must not contain custom fields.`);
}

export function normalizeResearchNarrativeText(value, label = "Research narrative text") {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  const normalized = value.trim().replace(/\s+/gu, " ");
  if (FORBIDDEN_TEXT.some((pattern) => pattern.test(normalized))) throw new Error(`${label} must not contain private or control metadata.`);
  return normalized;
}

export function safeResearchNarrativeSourceText(value) {
  try {
    return normalizeResearchNarrativeText(value);
  } catch {
    return null;
  }
}

function normalizeTexts(value, label) {
  assertJsonArray(value, label);
  return Object.freeze([...new Set(value.map((item, index) => normalizeResearchNarrativeText(item, `${label}[${index}]`)))]);
}

function normalizeObjects(value, fields, label, normalizeItem) {
  assertJsonArray(value, label);
  return Object.freeze(value.map((item, index) => {
    const itemLabel = `${label}[${index}]`;
    assertSealedRecord(item, fields, itemLabel);
    for (const field of fields) if (!Object.hasOwn(item, field)) throw new Error(`${itemLabel} requires $.${field}.`);
    return Object.freeze(normalizeItem(item, itemLabel));
  }));
}

export function normalizeResearchNarrative(value) {
  assertSealedRecord(value, NARRATIVE_FIELDS, "ResearchNarrative");
  for (const field of NARRATIVE_FIELDS) {
    if (!["nextStep", "stopReason"].includes(field) && !Object.hasOwn(value, field)) throw new Error(`ResearchNarrative requires $.${field}.`);
  }
  const nextStep = value.nextStep == null ? null : normalizeResearchNarrativeText(value.nextStep, "ResearchNarrative.nextStep");
  const stopReason = value.stopReason == null ? null : normalizeResearchNarrativeText(value.stopReason, "ResearchNarrative.stopReason");
  if ((nextStep === null) === (stopReason === null)) throw new Error("ResearchNarrative requires exactly one of nextStep or stopReason.");
  return Object.freeze({
    researchDirection: normalizeResearchNarrativeText(value.researchDirection, "ResearchNarrative.researchDirection"),
    currentUnderstanding: normalizeTexts(value.currentUnderstanding, "ResearchNarrative.currentUnderstanding"),
    evidence: normalizeTexts(value.evidence, "ResearchNarrative.evidence"),
    unknowns: normalizeTexts(value.unknowns, "ResearchNarrative.unknowns"),
    currentValueJudgment: normalizeResearchNarrativeText(value.currentValueJudgment, "ResearchNarrative.currentValueJudgment"),
    nextStep,
    stopReason,
    rejectedDirections: normalizeObjects(value.rejectedDirections, REJECTED_DIRECTION_FIELDS, "ResearchNarrative.rejectedDirections", (item, label) => ({
      direction: normalizeResearchNarrativeText(item.direction, `${label}.direction`),
      reason: normalizeResearchNarrativeText(item.reason, `${label}.reason`)
    })),
    applicableLessons: normalizeObjects(value.applicableLessons, APPLICABLE_LESSON_FIELDS, "ResearchNarrative.applicableLessons", (item, label) => ({
      lesson: normalizeResearchNarrativeText(item.lesson, `${label}.lesson`),
      application: normalizeResearchNarrativeText(item.application, `${label}.application`)
    }))
  });
}

export function buildResearchNarrative(value) {
  return normalizeResearchNarrative(value);
}

function safeDecisionTexts(values, fallback) {
  if (values.length === 0) return [];
  const safe = values.map(safeResearchNarrativeSourceText).filter(Boolean);
  return safe.length > 0 ? safe : [fallback];
}

export function buildResearchNarrativeFromDecision(value, options = {}) {
  assertSealedRecord(options, BUILD_FROM_DECISION_OPTION_FIELDS, "ResearchNarrative decision options");
  const decision = validatePersistedResearchDecision(value, { label: "Research narrative decision" });
  const directive = options.awaitingReevaluation === true
    ? Object.freeze({ mode: "next-step", text: "Reevaluate the recorded execution evidence before repeating or authorizing another action." })
    : researchDecisionNarrativeDirective(decision);
  const synthesis = safeResearchNarrativeSourceText(decision.synthesis) ?? "A current research judgment is recorded, but its wording cannot be shown safely.";
  const evidence = safeDecisionTexts(decision.evidenceRefs, "Current recorded evidence exists, but its internal references are not public.");
  const unknowns = safeDecisionTexts(decision.openQuestions.map((item) => item.question), "A recorded research uncertainty exists, but its wording cannot be shown safely.");
  const rejectedDirections = decision.routes.filter((route) => route.disposition === "rejected").flatMap((route) => {
    const direction = safeResearchNarrativeSourceText(route.summary);
    const reason = safeResearchNarrativeSourceText(route.rationale);
    return direction && reason ? [{ direction, reason }] : [];
  });
  const directiveText = directive.mode === "authorized-action"
    ? safeResearchNarrativeSourceText(decision.nextAction.description) ?? "Perform the current bounded research action."
    : safeResearchNarrativeSourceText(directive.text) ?? "Reevaluate the current evidence before authorizing another action.";
  return normalizeResearchNarrative({
    researchDirection: synthesis,
    currentUnderstanding: [synthesis],
    evidence,
    unknowns,
    currentValueJudgment: synthesis,
    nextStep: directive.mode === "stop-reason" ? null : directiveText,
    stopReason: directive.mode === "stop-reason" ? directiveText : null,
    rejectedDirections,
    applicableLessons: []
  });
}

function renderChinese(narrative) {
  const lines = [
    `当前任务的研究方向是：${narrative.researchDirection}`,
    `目前的认识是：${narrative.currentUnderstanding.join("；")}`,
    narrative.evidence.length > 0 ? `现有证据包括：${narrative.evidence.join("；")}` : "目前还没有足以支撑判断的直接证据。",
    narrative.unknowns.length > 0 ? `还不知道的是：${narrative.unknowns.join("；")}` : "当前没有明确的关键未知。",
    `就目前而言：${narrative.currentValueJudgment}`
  ];
  if (narrative.rejectedDirections.length > 0) lines.push(`已经否定的方向包括：${narrative.rejectedDirections.map((item) => `${item.direction}（${item.reason}）`).join("；")}`);
  if (narrative.applicableLessons.length > 0) lines.push(`可沿用的经验是：${narrative.applicableLessons.map((item) => `${item.lesson}，用于${item.application}`).join("；")}`);
  lines.push(narrative.nextStep ? `下一步：${narrative.nextStep}` : `现在可以停止，因为${narrative.stopReason}`);
  return lines.join("\n\n");
}

function renderEnglish(narrative) {
  const lines = [
    `This mission is centered on: ${narrative.researchDirection}`,
    `Current understanding: ${narrative.currentUnderstanding.join("; ")}`,
    narrative.evidence.length > 0 ? `The evidence so far includes: ${narrative.evidence.join("; ")}` : "There is not yet direct evidence strong enough to support the judgment.",
    narrative.unknowns.length > 0 ? `What remains unknown: ${narrative.unknowns.join("; ")}` : "There are no clearly identified critical unknowns at present.",
    `At this point: ${narrative.currentValueJudgment}`
  ];
  if (narrative.rejectedDirections.length > 0) lines.push(`Directions already ruled out: ${narrative.rejectedDirections.map((item) => `${item.direction} (${item.reason})`).join("; ")}`);
  if (narrative.applicableLessons.length > 0) lines.push(`Applicable lessons: ${narrative.applicableLessons.map((item) => `${item.lesson}, applied to ${item.application}`).join("; ")}`);
  lines.push(narrative.nextStep ? `Next: ${narrative.nextStep}` : `The mission can stop here because ${narrative.stopReason}`);
  return lines.join("\n\n");
}

export function renderResearchNarrative(value, options = {}) {
  assertSealedRecord(options, RENDER_OPTION_FIELDS, "ResearchNarrative render options");
  const language = options.language ?? "zh";
  if (typeof language !== "string" || !SUPPORTED_LANGUAGES.has(language)) throw new Error("ResearchNarrative render language must be zh or en.");
  const narrative = normalizeResearchNarrative(value);
  return language === "zh" ? renderChinese(narrative) : renderEnglish(narrative);
}
