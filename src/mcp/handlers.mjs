import { resolveDoveResponseLanguage } from "../core/i18n.mjs";
import { normalizeHostWorkspaceFilePath } from "../core/host-path-normalizer.mjs";
import { TOOL_INPUT_SCHEMAS } from "./tool-definitions.mjs";
import { assertMcpInputSchema } from "./schema-validation.mjs";
import { invokeResearchAdapter } from "./research-adapter.mjs";

const PRIVATE_KEYS = new Set([
  "writes",
  "diagnostics",
  "reviewedArtifactSetSha256"
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function publicValue(value) {
  if (Array.isArray(value)) return value.map((item) => publicValue(item)).filter((item) => item !== undefined);
  if (!isPlainObject(value)) {
    if (typeof value === "string" && (value.startsWith(".dove/") || value.startsWith("/"))) return undefined;
    return value;
  }
  const projected = {};
  for (const [field, item] of Object.entries(value)) {
    if (PRIVATE_KEYS.has(field) || /(?:Digest|Token|Binding)$/u.test(field)) continue;
    const next = publicValue(item);
    if (next !== undefined) projected[field] = next;
  }
  return projected;
}

function successMessage(name, data, language) {
  if (typeof data?.markdown === "string") return data.markdown;
  if (data?.status === "absent") {
    return language === "en"
      ? "No Dove Research Workspace has been established. Nothing was written; you can first inspect ordinary project materials and initialize research state only if explicitly needed."
      : "当前尚未建立 Dove Research Workspace。本次没有写入任何内容；可以先查看普通项目材料，只有明确需要时再初始化研究状态。";
  }
  const messages = language === "en" ? {
    query_dove_research: "The requested research context was read without changing it.",
    manage_dove_workspace: "The research direction was updated.",
    manage_dove_missions: "The requested Mission operation completed.",
    manage_dove_sources: "The requested Source operation completed.",
    manage_dove_experiments: "The requested Experiment operation completed.",
    manage_dove_claims: "The requested Claim operation completed.",
    manage_dove_reviews: "The requested review exchange operation completed.",
    manage_dove_lessons: "The Lessons document was updated."
  } : {
    query_dove_research: "已读取所需研究上下文，没有修改研究状态。",
    manage_dove_workspace: "已更新研究方向。",
    manage_dove_missions: "已完成所请求的 Mission 操作。",
    manage_dove_sources: "已完成所请求的 Source 操作。",
    manage_dove_experiments: "已完成所请求的 Experiment 操作。",
    manage_dove_claims: "已完成所请求的 Claim 操作。",
    manage_dove_reviews: "已完成所请求的评审交换操作。",
    manage_dove_lessons: "已更新 Lessons 文档。"
  };
  return messages[name] ?? (language === "en" ? "The requested Dove operation completed." : "已完成所请求的 Dove 操作。");
}

function knownFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/Unknown missionId|unknown Mission/iu.test(message)) return "unknown-mission";
  if (/does not allow|requires|must be|unknown input|not allowed/iu.test(message)) return "invalid-input";
  if (/legacy|unsupported.*format/iu.test(message)) return "unsupported-format";
  if (/invalid Dove Research|malformed|unknown-format|invalid-root/iu.test(message)) return "invalid-research-state";
  if (/refuses|blocked|conflict/iu.test(message)) return "blocked";
  return "internal-error";
}

function failureMessage(reason, language) {
  const messages = language === "en" ? {
    "unknown-mission": "The requested Mission is not present in the current research records.",
    "invalid-input": "The request does not match the public Dove tool contract. Check the supplied fields and try again.",
    "unsupported-format": "The project uses a Dove research format that this version will not read or modify.",
    "invalid-research-state": "The Dove research state is incomplete or invalid, so the operation was stopped without changes.",
    blocked: "The operation was stopped by a Dove safety boundary without applying changes.",
    "internal-error": "The Dove operation could not safely return a result. No research judgment or review authority was recorded."
  } : {
    "unknown-mission": "当前研究记录中不存在所请求的 Mission。",
    "invalid-input": "请求不符合公开 Dove 工具合同，请检查所提供的字段后重试。",
    "unsupported-format": "项目使用了当前版本不读取、也不修改的 Dove 研究格式。",
    "invalid-research-state": "Dove 研究状态不完整或无效，操作已停止且未做修改。",
    blocked: "操作触发了 Dove 安全边界，已停止且未应用修改。",
    "internal-error": "Dove 操作未能安全返回结果；没有记录任何研究判断或评审权威。"
  };
  return messages[reason];
}

function toolResult(name, data, language) {
  const research = publicValue(data);
  return {
    content: [{ type: "text", text: successMessage(name, research, language) }],
    structuredContent: {
      status: research.status ?? "ok",
      operation: name,
      research
    }
  };
}

function toolFailure(name, error, language) {
  const reason = knownFailure(error);
  return {
    content: [{ type: "text", text: failureMessage(reason, language) }],
    structuredContent: {
      status: "error",
      operation: name,
      research: { status: "error", reason }
    },
    isError: true
  };
}

function normalizePaths(root, name, args) {
  const result = structuredClone(args);
  delete result.language;
  const file = (value, label) => normalizeHostWorkspaceFilePath(root, value, label);
  const files = (values, label) => Array.isArray(values) ? values.map((value, index) => file(value, `${label}[${index}]`)) : values;
  if (name === "manage_dove_sources" && result.capturePath !== undefined) result.capturePath = file(result.capturePath, "capturePath");
  if (name === "manage_dove_reviews") result.artifactPaths = files(result.artifactPaths, "artifactPaths");
  if (name === "manage_dove_experiments" && result.artifactRefs !== undefined) result.artifactRefs = files(result.artifactRefs, "artifactRefs");
  if (name === "manage_dove_claims" && Array.isArray(result.claims)) result.claims = result.claims.map((claim, index) => ({
    ...claim,
    artifactRefs: files(claim.artifactRefs, `claims[${index}].artifactRefs`)
  }));
  return result;
}

export function dispatchTool(root, name, args = {}, options = {}) {
  let language;
  try {
    language = resolveDoveResponseLanguage(root, args, { env: options.env, configLanguage: options.language });
    const schema = TOOL_INPUT_SCHEMAS.get(name);
    if (!schema) throw new Error(`Unknown tool: ${name}`);
    assertMcpInputSchema(name, args, schema);
    const data = invokeResearchAdapter(root, name, normalizePaths(root, name, args));
    return data && typeof data.then === "function"
      ? data.then((value) => toolResult(name, value, language)).catch((error) => toolFailure(name, error, language))
      : toolResult(name, data, language);
  } catch (error) {
    return toolFailure(name, error, language ?? "zh");
  }
}
