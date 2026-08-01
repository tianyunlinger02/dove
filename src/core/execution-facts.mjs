import crypto from "node:crypto";

const SCIENTIFIC_CONCLUSION_PATTERNS = Object.freeze([
  /\b(?:hypothesis|theory|mechanism|method|approach|model|algorithm|intervention)\b.{0,80}\b(?:proven|proved|confirmed|validated|supported|refuted|true|false|superior|inferior|causal|causes?|outperform(?:s|ed)?|improv(?:es|ed))\b/iu,
  /\b(?:results?|findings?|data|evidence|experiment)\b.{0,48}\b(?:prove[sd]?|confirm(?:s|ed)?|validate[sd]?|support(?:s|ed)?|refute[sd]?|demonstrate[sd]?|establish(?:es|ed)?|show(?:s|ed)?\s+that)\b.{0,80}\b(?:hypothesis|theory|mechanism|method|approach|model|algorithm|intervention|causal|superior|inferior)\b/iu,
  /\b(?:scientific|research)\s+conclusion\b/iu,
  /(?:假设|理论|机制|方法|方案|模型|算法|干预).{0,40}(?:被?证明|被?证实|被?确认|被?验证|成立|不成立|正确|错误|优于|劣于|具有因果|导致)/u,
  /(?:结果|发现|数据|证据|实验).{0,30}(?:证明|证实|确认|验证|支持|否定|表明|显示).{0,40}(?:假设|理论|机制|方法|方案|模型|算法|因果|结论)/u,
  /科研结论|科学结论/u
]);

export const EXECUTION_FACT_FIELDS = Object.freeze(["factId", "statement"]);
const FACT_ID = /^fact-[0-9a-f]{24}$/u;

export function assertExecutionFactText(value, label = "Execution fact") {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  const statement = value.trim();
  if (SCIENTIFIC_CONCLUSION_PATTERNS.some((pattern) => pattern.test(statement))) {
    throw new Error(`${label} may report execution facts only; the host cannot declare a hypothesis proven or a scientific conclusion.`);
  }
  return statement;
}

export function executionFactHash(statement) {
  return crypto.createHash("sha256").update(assertExecutionFactText(statement)).digest("hex");
}

export function executionFactId(statement) {
  return `fact-${executionFactHash(statement).slice(0, 24)}`;
}

export function createExecutionFact(value, label = "Execution fact") {
  const statement = typeof value === "string" ? assertExecutionFactText(value, label) : assertExecutionFactText(value?.statement, `${label}.statement`);
  const factId = typeof value === "string" || value?.factId === undefined ? executionFactId(statement) : value.factId;
  if (!FACT_ID.test(factId) || factId !== executionFactId(statement)) throw new Error(`${label}.factId must match the stable execution fact statement digest.`);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const unknown = Object.keys(value).filter((field) => !EXECUTION_FACT_FIELDS.includes(field));
    if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
  return Object.freeze({ factId, statement });
}

export function readStoredExecutionFact(value, label = "Execution fact") {
  return createExecutionFact(value, label);
}
