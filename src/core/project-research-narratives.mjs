import { buildResearchNarrativeFromDecision, normalizeResearchNarrativeText, safeResearchNarrativeSourceText } from "./research-narratives.mjs";
import { validatePersistedResearchDecision } from "./research-decisions.mjs";

const PROJECT_NARRATIVE_FIELDS = new Set([
  "mainline",
  "activeDirections",
  "evidence",
  "unknowns",
  "rejectedDirections",
  "historicalWorkWithoutJudgment",
  "currentValueJudgment",
  "recommendation",
  "recommendationReason",
  "applicableLessons"
]);
const ACTIVE_DIRECTION_FIELDS = new Set(["direction", "currentUnderstanding"]);
const REJECTED_DIRECTION_FIELDS = new Set(["direction", "reason"]);
const APPLICABLE_LESSON_FIELDS = new Set(["lesson", "application"]);
const RENDER_OPTION_FIELDS = new Set(["language"]);
const SUPPORTED_LANGUAGES = new Set(["zh", "en"]);
const TERMINAL_STOP_KINDS = new Set(["stop-satisfied", "stop-low-return", "stop-budget", "reject"]);
const PROJECT_NARRATIVE_LIMITS = Object.freeze({
  activeDirections: 20,
  evidence: 24,
  unknowns: 24,
  rejectedDirections: 20,
  historicalWorkWithoutJudgment: 20,
  applicableLessons: 20
});

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

function assertSealedRecord(value, allowed, label) {
  assertPlainRecord(value, label);
  const unknown = Object.keys(value).filter((field) => !allowed.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}

function assertJsonArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const unexpected = Reflect.ownKeys(value).filter((key) => typeof key !== "string" || (key !== "length" && !/^(?:0|[1-9][0-9]*)$/u.test(key)));
  if (unexpected.length > 0) throw new Error(`${label} must not contain custom fields.`);
}

function assertBoundedLength(value, limit, label) {
  if (value.length > limit) throw new Error(`${label} must contain at most ${limit} items.`);
}

function normalizeTexts(value, label, limit) {
  assertJsonArray(value, label);
  assertBoundedLength(value, limit, label);
  const items = value.map((item, index) => normalizeResearchNarrativeText(item, `${label}[${index}]`));
  if (new Set(items).size !== items.length) throw new Error(`${label} must not contain duplicates.`);
  return Object.freeze(items);
}

function normalizeObjects(value, fields, label, limit, normalizeItem) {
  assertJsonArray(value, label);
  assertBoundedLength(value, limit, label);
  return Object.freeze(value.map((item, index) => {
    const itemLabel = `${label}[${index}]`;
    assertSealedRecord(item, fields, itemLabel);
    return Object.freeze(normalizeItem(item, itemLabel));
  }));
}

export function normalizeProjectResearchNarrative(value) {
  assertSealedRecord(value, PROJECT_NARRATIVE_FIELDS, "ProjectResearchNarrative");
  for (const field of PROJECT_NARRATIVE_FIELDS) {
    if (!Object.hasOwn(value, field)) throw new Error(`ProjectResearchNarrative requires $.${field}.`);
  }
  return Object.freeze({
    mainline: normalizeResearchNarrativeText(value.mainline, "ProjectResearchNarrative.mainline"),
    activeDirections: normalizeObjects(value.activeDirections, ACTIVE_DIRECTION_FIELDS, "ProjectResearchNarrative.activeDirections", PROJECT_NARRATIVE_LIMITS.activeDirections, (item, label) => ({
      direction: normalizeResearchNarrativeText(item.direction, `${label}.direction`),
      currentUnderstanding: normalizeResearchNarrativeText(item.currentUnderstanding, `${label}.currentUnderstanding`)
    })),
    evidence: normalizeTexts(value.evidence, "ProjectResearchNarrative.evidence", PROJECT_NARRATIVE_LIMITS.evidence),
    unknowns: normalizeTexts(value.unknowns, "ProjectResearchNarrative.unknowns", PROJECT_NARRATIVE_LIMITS.unknowns),
    rejectedDirections: normalizeObjects(value.rejectedDirections, REJECTED_DIRECTION_FIELDS, "ProjectResearchNarrative.rejectedDirections", PROJECT_NARRATIVE_LIMITS.rejectedDirections, (item, label) => ({
      direction: normalizeResearchNarrativeText(item.direction, `${label}.direction`),
      reason: normalizeResearchNarrativeText(item.reason, `${label}.reason`)
    })),
    historicalWorkWithoutJudgment: normalizeTexts(value.historicalWorkWithoutJudgment, "ProjectResearchNarrative.historicalWorkWithoutJudgment", PROJECT_NARRATIVE_LIMITS.historicalWorkWithoutJudgment),
    currentValueJudgment: normalizeResearchNarrativeText(value.currentValueJudgment, "ProjectResearchNarrative.currentValueJudgment"),
    recommendation: normalizeResearchNarrativeText(value.recommendation, "ProjectResearchNarrative.recommendation"),
    recommendationReason: normalizeResearchNarrativeText(value.recommendationReason, "ProjectResearchNarrative.recommendationReason"),
    applicableLessons: normalizeObjects(value.applicableLessons, APPLICABLE_LESSON_FIELDS, "ProjectResearchNarrative.applicableLessons", PROJECT_NARRATIVE_LIMITS.applicableLessons, (item, label) => ({
      lesson: normalizeResearchNarrativeText(item.lesson, `${label}.lesson`),
      application: normalizeResearchNarrativeText(item.application, `${label}.application`)
    }))
  });
}

export function buildProjectResearchNarrative(value) {
  return normalizeProjectResearchNarrative(value);
}

function safeText(value, fallback) {
  return safeResearchNarrativeSourceText(value) ?? fallback;
}

function projectEvidenceText(value) {
  const safe = safeResearchNarrativeSourceText(value);
  if (safe === null) return "Additional current evidence exists, but its wording cannot be shown safely in the project narrative.";
  if (/^artifact:/u.test(safe)) return "Current recorded artifact evidence supports the project judgment.";
  if (/^validation:/u.test(safe)) return "Current recorded validation evidence supports the project judgment.";
  if (/^source:/u.test(safe)) return "Current eligible source evidence supports the project judgment.";
  return safe;
}

function uniqueBy(items, keyOf) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function bounded(items, limit) {
  return items.slice(0, limit);
}

function decisionAction(decision) {
  return decision.nextAction ?? null;
}

function isTerminal(decision) {
  return TERMINAL_STOP_KINDS.has(decision.disposition) || decision.disposition === "block-needs-user";
}

function currentRecommendationEntry(entries) {
  return entries.find((entry) => entry.assessment?.researchOutcome?.awaitingReevaluation === true)
    ?? entries.find((entry) => entry.decision.disposition === "block-needs-user")
    ?? entries[0]
    ?? null;
}

function recommendationFor(chosen) {
  if (!chosen) return { recommendation: "Establish a current research judgment for an active mission before authorizing further work.", recommendationReason: "Only historical or terminal mission judgments are available." };
  const { decision, mission } = chosen;
  const direction = safeText(mission.goal, "the current research direction");
  if (chosen.assessment?.researchOutcome?.awaitingReevaluation === true) return { recommendation: `Reevaluate the recorded execution evidence for: ${direction}`, recommendationReason: "Execution facts exist, but the current scientific judgment has not consumed them." };
  if (decision.disposition === "block-needs-user") return { recommendation: `Resolve the user decision for: ${direction}`, recommendationReason: safeText(decision.synthesis, "The direction cannot advance until the recorded blocker is resolved.") };
  if (decision.nextAction) return { recommendation: safeText(decision.nextAction.description, "Perform the current bounded research action."), recommendationReason: safeText(decision.nextAction.rationale, "The current scientific judgment authorizes this action.") };
  if (!isTerminal(decision)) return { recommendation: `Reevaluate the current evidence for: ${direction}`, recommendationReason: safeText(decision.synthesis, "The direction remains current but has no authorized action.") };
  return { recommendation: "Stop project-level research unless new evidence or explicit user direction changes the current judgments.", recommendationReason: safeText(decision.synthesis, "The current research judgment is terminal.") };
}

function rejectedDirections(entries) {
  const rejected = [];
  for (const entry of entries.values()) {
    const decision = entry.decision;
    if (!decision) continue;
    if (!entry.active || ["stop-low-return", "stop-budget", "reject"].includes(decision.disposition)) rejected.push({ direction: safeText(entry.mission.goal, "A stopped research direction"), reason: safeText(entry.transition?.reason ?? decision.synthesis, "The current judgment does not support continuing this direction.") });
    for (const route of decision.routes.filter((item) => item.disposition === "rejected")) rejected.push({ direction: safeText(route.summary, "A rejected route"), reason: safeText(route.rationale, "The current judgment rejected this route.") });
  }
  return uniqueBy(rejected, (item) => `${item.direction}\n${item.reason}`);
}

export function buildProjectResearchNarrativeFromWorkspace({ mainline, currentWorkspaceRevisionId, missions, currentDecisions, assessments, missionTransitions = new Map() }) {
  if (!Array.isArray(missions)) throw new Error("Project research narrative missions must be an array.");
  const researchMissions = missions.filter((mission) => mission.mode === "research");
  const entries = new Map(researchMissions.map((mission, publicOrder) => {
    const decisionValue = currentDecisions.get(mission.missionId) ?? null;
    const decision = decisionValue ? validatePersistedResearchDecision(decisionValue, { label: "Project research narrative decision" }) : null;
    return [mission.missionId, { mission, publicOrder, decision, assessment: assessments.get(mission.missionId) ?? null, transition: missionTransitions.get(mission.missionId) ?? null, active: mission.workspaceRevisionId === currentWorkspaceRevisionId && !missionTransitions.has(mission.missionId) }];
  }));
  const decisionEntries = [...entries.values()].filter((entry) => entry.decision !== null);
  if (decisionEntries.length === 0) return null;
  const currentEntries = decisionEntries.filter((entry) => entry.active);
  const chosen = currentRecommendationEntry(currentEntries);
  const activeEntries = currentEntries.filter((entry) => !isTerminal(entry.decision));
  const singleNarratives = decisionEntries.map((entry) => ({ entry, narrative: buildResearchNarrativeFromDecision(entry.decision) }));
  const evidence = uniqueBy(singleNarratives.filter(({ entry }) => entry.active).flatMap(({ narrative }) => narrative.evidence.map(projectEvidenceText)), (item) => item);
  const unknowns = uniqueBy(singleNarratives.filter(({ entry }) => entry.active).flatMap(({ narrative }) => narrative.unknowns), (item) => item);
  const recommendation = recommendationFor(chosen);
  const historicalWithoutDecision = [...entries.values()].filter((entry) => entry.decision === null).map((entry) => safeText(entry.mission.goal, "Historical research work without a current judgment"));
  const authorizedCount = currentEntries.filter((entry) => decisionAction(entry.decision) !== null).length;
  const awaitingCount = currentEntries.filter((entry) => entry.assessment?.researchOutcome?.awaitingReevaluation === true).length;
  return normalizeProjectResearchNarrative({
    mainline: safeText(mainline, "Advance the approved project research mainline."),
    activeDirections: bounded(activeEntries.map((entry) => ({ direction: safeText(entry.mission.goal, "A current mission research direction"), currentUnderstanding: safeText(entry.decision.synthesis, "A current research judgment is recorded for this direction.") })), PROJECT_NARRATIVE_LIMITS.activeDirections),
    evidence: bounded(evidence, PROJECT_NARRATIVE_LIMITS.evidence),
    unknowns: bounded(unknowns, PROJECT_NARRATIVE_LIMITS.unknowns),
    rejectedDirections: bounded(rejectedDirections(entries), PROJECT_NARRATIVE_LIMITS.rejectedDirections),
    historicalWorkWithoutJudgment: bounded(historicalWithoutDecision, PROJECT_NARRATIVE_LIMITS.historicalWorkWithoutJudgment),
    currentValueJudgment: safeText(chosen?.decision.synthesis, awaitingCount > 0 ? "Recorded research outcomes await scientific reevaluation." : authorizedCount > 0 ? "At least one current direction has a bounded authorized action." : "A current judgment exists, but no bounded action is authorized."),
    ...recommendation,
    applicableLessons: []
  });
}

function sentence(value) {
  return /[.!?。！？]$/u.test(value) ? value : `${value}。`;
}

function renderChinese(narrative) {
  const lines = [
    sentence(`当前科研主线是：${narrative.mainline}`)
  ];
  if (narrative.activeDirections.length > 0) lines.push(sentence(`各活跃方向的当前认识是：${narrative.activeDirections.map((item) => `${item.direction}（${item.currentUnderstanding}）`).join("；")}`));
  else lines.push("当前没有仍在推进的科研方向。");
  lines.push(narrative.evidence.length > 0 ? sentence(`关键证据包括：${narrative.evidence.join("；")}`) : "目前还没有可公开展示的直接证据。");
  lines.push(narrative.unknowns.length > 0 ? sentence(`最大未知包括：${narrative.unknowns.join("；")}`) : "当前没有明确记录的关键未知。");
  if (narrative.rejectedDirections.length > 0) lines.push(sentence(`已经停止、拒绝或转向的方向包括：${narrative.rejectedDirections.map((item) => `${item.direction}（${item.reason}）`).join("；")}`));
  if (narrative.historicalWorkWithoutJudgment.length > 0) lines.push(sentence(`尚无科研判断的历史工作包括：${narrative.historicalWorkWithoutJudgment.join("；")}`));
  lines.push(sentence(`当前价值判断是：${narrative.currentValueJudgment}`));
  if (narrative.applicableLessons.length > 0) lines.push(sentence(`适用经验包括：${narrative.applicableLessons.map((item) => `${item.lesson}，用于${item.application}`).join("；")}`));
  lines.push(sentence(`最值得做的下一步是：${narrative.recommendation}`));
  lines.push(sentence(`选择依据是：${narrative.recommendationReason}`));
  return lines.join("\n\n");
}

function renderEnglish(narrative) {
  const lines = [sentence(`The current research mainline is: ${narrative.mainline}`)];
  if (narrative.activeDirections.length > 0) lines.push(sentence(`Current understanding across active directions is: ${narrative.activeDirections.map((item) => `${item.direction} (${item.currentUnderstanding})`).join("; ")}`));
  else lines.push("There is no research direction currently advancing.");
  lines.push(narrative.evidence.length > 0 ? sentence(`Key evidence is: ${narrative.evidence.join("; ")}`) : "There is no direct public evidence to show yet.");
  lines.push(narrative.unknowns.length > 0 ? sentence(`The largest unknowns are: ${narrative.unknowns.join("; ")}`) : "There is no clearly recorded critical unknown at present.");
  if (narrative.rejectedDirections.length > 0) lines.push(sentence(`Stopped or rejected mission directions include: ${narrative.rejectedDirections.map((item) => `${item.direction} (${item.reason})`).join("; ")}`));
  if (narrative.historicalWorkWithoutJudgment.length > 0) lines.push(sentence(`Historical work without a research judgment includes: ${narrative.historicalWorkWithoutJudgment.join("; ")}`));
  lines.push(sentence(`The current value judgment is: ${narrative.currentValueJudgment}`));
  if (narrative.applicableLessons.length > 0) lines.push(sentence(`Applicable lessons include: ${narrative.applicableLessons.map((item) => `${item.lesson}, applied to ${item.application}`).join("; ")}`));
  lines.push(sentence(`The most valuable next step is: ${narrative.recommendation}`));
  lines.push(sentence(`The selection basis is: ${narrative.recommendationReason}`));
  return lines.join("\n\n");
}

export function renderProjectResearchNarrative(value, options = {}) {
  assertSealedRecord(options, RENDER_OPTION_FIELDS, "ProjectResearchNarrative render options");
  const language = options.language ?? "zh";
  if (typeof language !== "string" || !SUPPORTED_LANGUAGES.has(language)) throw new Error("ProjectResearchNarrative render language must be zh or en.");
  const narrative = normalizeProjectResearchNarrative(value);
  return language === "zh" ? renderChinese(narrative) : renderEnglish(narrative);
}
