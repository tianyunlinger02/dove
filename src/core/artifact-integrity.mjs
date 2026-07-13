import fs from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";

import { ARTIFACT_PATHS } from "./schema.mjs";

const DEFAULT_READ_LIMIT_BYTES = 24 * 1024;

const ARTIFACT_EVIDENCE_ROLES = new Map([
  [ARTIFACT_PATHS.researchBrief, "conditional"],
  [ARTIFACT_PATHS.researchAgenda, "conditional"],
  [ARTIFACT_PATHS.plan, "conditional"],
  [ARTIFACT_PATHS.outline, "conditional"],
  [ARTIFACT_PATHS.findings, "conditional"],
  [ARTIFACT_PATHS.experimentLog, "conditional"],
  [ARTIFACT_PATHS.experimentPlans, "conditional"],
  [ARTIFACT_PATHS.experimentResults, "conditional"],
  [ARTIFACT_PATHS.experimentAudits, "conditional"],
  [ARTIFACT_PATHS.notes, "conditional"],
  [ARTIFACT_PATHS.evidence, "conditional"],
  [ARTIFACT_PATHS.claims, "conditional"],
  [ARTIFACT_PATHS.claimBridgeLog, "conditional"],
  [ARTIFACT_PATHS.reviewLog, "conditional"],
  [ARTIFACT_PATHS.reviewReport, "conditional"],
  [ARTIFACT_PATHS.reviewConcerns, "conditional"],
  [ARTIFACT_PATHS.reviewDebateLog, "conditional"],
  [ARTIFACT_PATHS.revisionPlan, "conditional"],
  [ARTIFACT_PATHS.wiki, "conditional"],
  [ARTIFACT_PATHS.bibliography, "conditional"],
  [ARTIFACT_PATHS.citationLog, "conditional"],
  [ARTIFACT_PATHS.figureBriefs, "conditional"],
  [ARTIFACT_PATHS.figureSegments, "conditional"],
  [ARTIFACT_PATHS.figureTemplates, "conditional"],
  [ARTIFACT_PATHS.figureEditableIndex, "conditional"],
  [ARTIFACT_PATHS.figureFinalIndex, "conditional"],
  [ARTIFACT_PATHS.figureMaterials, "conditional"],
  [ARTIFACT_PATHS.figureGenerations, "conditional"],
  [ARTIFACT_PATHS.figureCaptions, "conditional"],
  [ARTIFACT_PATHS.figureQa, "conditional"],
  [ARTIFACT_PATHS.rebuttalIssues, "conditional"],
  [ARTIFACT_PATHS.rebuttalStrategy, "conditional"],
  [ARTIFACT_PATHS.rebuttalResponseDraft, "conditional"],
  [ARTIFACT_PATHS.versionComparisons, "conditional"],
  [ARTIFACT_PATHS.versionComparisonReport, "conditional"]
]);

const BOOKKEEPING_ARTIFACT_PATHS = new Set(
  Object.values(ARTIFACT_PATHS).filter((artifactPath) => (
    typeof artifactPath === "string"
    && artifactPath.startsWith(`${ARTIFACT_PATHS.doveRoot}/`)
    && path.posix.extname(artifactPath).length > 0
    && !ARTIFACT_EVIDENCE_ROLES.has(artifactPath)
  ))
);

const DYNAMIC_EVIDENCE_PATTERNS = [
  { pattern: /^\.dove\/drafts\/(?!README\.md$)[^/]+\.(?:md|txt|tex)$/u, role: "substantive" },
  { pattern: /^\.dove\/evidence\/(?!index\.json$).+$/u, role: "validation" },
  { pattern: /^\.dove\/(?:reviews\/isolated|audio\/reviews)\/[^/]+\/report\.md$/u, role: "conditional" },
  { pattern: /^\.dove\/figures\/(?!runs\/).+\.(?:final\.svg|png|jpe?g|pdf)$/iu, role: "conditional" }
];

const WORKFLOW_GOAL_COMPLETION_EVIDENCE_ROLES = new Map([
  [".dove/evidence/workflow-goal-verification.log", "validation"],
  [".dove/evidence/workflow-goal-result.md", "substantive"]
]);

const DYNAMIC_COMPLETION_EVIDENCE_PATTERN = /^\.dove\/evidence\/(?!index\.json$).+$/u;
const COMPLETION_MEDIA_EXTENSIONS = new Map([
  [".svg", "svg"],
  [".png", "png"],
  [".jpg", "jpeg"],
  [".jpeg", "jpeg"],
  [".pdf", "pdf"]
]);
const NEGATIVE_VALIDATION_STATUSES = new Set([
  "author-response-submitted",
  "awaiting-author-response",
  "blocked",
  "challenged",
  "concern",
  "contested",
  "escalated",
  "failed",
  "failure",
  "held",
  "held-audit-blocked",
  "held-for-review",
  "held-missing-claim",
  "incomplete",
  "inconclusive",
  "invalid",
  "needs-evidence",
  "needs-review",
  "needs-revision",
  "negative",
  "needs-operator",
  "needs-rebuttal",
  "needs-source-verification",
  "not-ready",
  "not-reviewed",
  "open",
  "pending",
  "rejected",
  "unresolved"
]);
const POSITIVE_VALIDATION_STATUSES = new Set([
  "applied",
  "approved",
  "clean",
  "coherent",
  "complete",
  "completed",
  "passed",
  "ready",
  "resolved",
  "verified"
]);
const REQUIREMENT_PURPOSE_PATTERNS = new Map([
  ["audit", /\b(?:audit|audited|integrity)\b|审计|完整性/iu],
  ["bridge", /\b(?:bridge|bridged|claim mapping)\b|桥接|论点映射/iu],
  ["comparison", /\b(?:compare|comparison|diff|version delta)\b|比较|对比|版本差异/iu],
  ["qa", /\b(?:qa|quality assurance|quality check)\b|质量检查|质检/iu],
  ["review", /\b(?:review|reviewer|verdict|concern)\b|审查|评审|问题项/iu],
  ["validation", /\b(?:check|lint|test|typecheck|validat(?:e|ed|ion)|verif(?:y|ied|ication))\b|测试|校验|验证/iu],
  ["artifact", /\b(?:artifact|deliverable|draft|figure|implementation|output|report)\b|产物|交付物|草稿|图|实现|输出|报告/iu],
  ["evidence", /\b(?:evidence|log|result|source|citation)\b|证据|日志|结果|来源|引文/iu]
]);

const BOOKKEEPING_EVIDENCE_PATTERNS = [
  /^\.dove\/(?:public|orchestration|task-packets|context|sessions|workspace|programs|workflow-pack|runtime|mutations|meta)(?:\/|$)/u,
  /^\.dove\/wiki\/(?:query_pack|navigation)\.md$/u,
  /^\.dove\/wiki\/(?:entities|relations)\.json$/u,
  /^\.dove\/(?:reviews\/isolated|audio\/reviews)\/[^/]+\/(?!report\.md$).+/u,
  /^\.dove\/versions\/snapshots(?:\/|$)/u,
  /^\.dove\/figures\/runs(?:\/|$)/u
];

const CONDITIONAL_JSON_COLLECTION_FIELDS = new Map([
  [ARTIFACT_PATHS.researchAgenda, ["agenda", "evidenceBacklog"]],
  [ARTIFACT_PATHS.experimentAudits, ["items"]],
  [ARTIFACT_PATHS.sources, ["items"]],
  [ARTIFACT_PATHS.notes, ["items"]],
  [ARTIFACT_PATHS.evidence, ["claims"]],
  [ARTIFACT_PATHS.claimBridgeLog, ["items"]],
  [ARTIFACT_PATHS.reviewConcerns, ["items"]],
  [ARTIFACT_PATHS.figureBriefs, ["items"]],
  [ARTIFACT_PATHS.figureSegments, ["items"]],
  [ARTIFACT_PATHS.figureTemplates, ["items"]],
  [ARTIFACT_PATHS.figureEditableIndex, ["items"]],
  [ARTIFACT_PATHS.figureFinalIndex, ["items"]],
  [ARTIFACT_PATHS.figureMaterials, ["items"]],
  [ARTIFACT_PATHS.figureGenerations, ["items"]],
  [ARTIFACT_PATHS.figureCaptions, ["items"]],
  [ARTIFACT_PATHS.figureQa, ["items", "issues"]],
  [ARTIFACT_PATHS.rebuttalIssues, ["items"]],
  [ARTIFACT_PATHS.versionComparisons, ["items"]]
]);

const BOOTSTRAP_MARKDOWN_PATTERNS = new Map([
  [ARTIFACT_PATHS.researchBrief, [/Clarify the paper objective and contribution\./iu, /澄清论文目标与贡献。/u]],
  [ARTIFACT_PATHS.plan, [/Run `project:dove\.status`/iu, /运行 `project:dove\.status`/u]],
  [ARTIFACT_PATHS.outline, [/(?:Goal|Evidence): TBD/iu, /(?:目标|证据): 待定/u]],
  [ARTIFACT_PATHS.findings, [/Capture key empirical or analytical takeaways here/iu, /在转化为 claims 前，在此记录/u]],
  [ARTIFACT_PATHS.experimentLog, [/Document planned runs, settings, outcomes/iu, /在此记录计划运行、设置、结果/u]],
  [ARTIFACT_PATHS.claims, [/List only claims that can be traced/iu, /只列出可追溯到/u]],
  [ARTIFACT_PATHS.reviewLog, [/Starter review log created\./iu, /已创建 starter 审查日志。/u]],
  [ARTIFACT_PATHS.reviewDebateLog, [/Use this file to capture adversarial review rounds/iu, /用此文件以持久文本记录/u]],
  [ARTIFACT_PATHS.revisionPlan, [/No review loop has generated/iu, /尚未由 review loop 生成/u]],
  [ARTIFACT_PATHS.wiki, [/- TBD/iu, /- 待定/u]],
  [ARTIFACT_PATHS.citationLog, [/Track registration and verification status/iu, /在此跟踪 sources 的注册和验证状态/u]],
  [ARTIFACT_PATHS.rebuttalStrategy, [/No issue strategy has been generated/iu, /尚未生成 issue strategy/u]],
  [ARTIFACT_PATHS.rebuttalResponseDraft, [/Draft concise, evidence-backed responses here/iu, /在此起草简洁且有证据支撑的回应/u]],
  [ARTIFACT_PATHS.versionComparisonReport, [/No comparison has been generated/iu, /尚未生成 comparison/u]]
]);

function normalizeStringArray(value) {
  const values = Array.isArray(value) ? value : (typeof value === "string" ? [value] : []);
  return Array.from(new Set(values.map((item) => String(item).trim()).filter(Boolean)));
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeLocalPath(value) {
  const normalized = normalizeProjectRelativePath(value);
  return normalized.ok ? normalized.normalizedPath : null;
}

function normalizeLocalPathArray(values) {
  return Array.from(new Set(normalizeStringArray(values).map(normalizeLocalPath).filter(Boolean)));
}

function flattenPathFields(value, fields) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenPathFields(item, fields));
  }
  const source = plainObject(value);
  return fields.flatMap((field) => normalizeStringArray(source[field]));
}

function explicitTaskLinkedPaths(task = {}) {
  const source = plainObject(task);
  const context = plainObject(source.context);
  const pathFields = [
    "artifactRefs",
    "artifactPaths",
    "artifacts",
    "outputPaths",
    "evidenceLinks",
    "evidencePaths",
    "validationEvidencePaths",
    "verificationEvidencePaths"
  ];
  return normalizeLocalPathArray([
    ...flattenPathFields([source, context], pathFields),
    ...flattenPathFields([source.verifiedCriteria, context.verifiedCriteria], ["evidencePaths"])
  ]);
}

function evidenceRequirementKind(value) {
  const requirement = String(value ?? "").trim();
  if (!requirement) {
    return "invalid";
  }
  if (isExternalArtifactReference(requirement)) {
    return "reference";
  }
  const normalized = normalizeProjectRelativePath(requirement);
  if (!normalized.ok) {
    return "invalid";
  }
  const looksNarrative = /\s|[，。；！？：]/u.test(normalized.normalizedPath);
  const pathLike = normalized.normalizedPath.startsWith(".")
    || (!looksNarrative && normalized.normalizedPath.includes("/"))
    || (!looksNarrative && path.posix.extname(normalized.normalizedPath).length > 0);
  return pathLike ? "reference" : "description";
}

function explicitContractLinkedPaths(executionContract = {}) {
  const contract = plainObject(executionContract);
  const materials = plainObject(contract.materials);
  const convergence = plainObject(contract.convergence);
  return normalizeLocalPathArray([
    ...flattenPathFields(contract.files, ["path", "target"]),
    ...normalizeStringArray(materials.requiredArtifacts).filter((item) => evidenceRequirementKind(item) === "reference"),
    ...normalizeStringArray(materials.artifactRefs).filter((item) => evidenceRequirementKind(item) === "reference"),
    ...normalizeStringArray(convergence.evidenceRequired).filter((item) => evidenceRequirementKind(item) === "reference")
  ]);
}

function normalizeCompletionRequirements(value, source = "caller") {
  const values = Array.isArray(value) ? value : (value === undefined || value === null ? [] : [value]);
  return values.map((item, index) => {
    if (typeof item === "string" && item.trim()) {
      const requirement = item.trim();
      return {
        id: `${source}-${index + 1}`,
        requirement,
        purpose: null,
        evidencePaths: evidenceRequirementKind(requirement) === "reference"
          ? normalizeLocalPathArray([requirement])
          : [],
        source
      };
    }
    const requirement = plainObject(item);
    const text = String(requirement.requirement ?? requirement.description ?? requirement.text ?? requirement.title ?? "").trim();
    if (!text) {
      return null;
    }
    return {
      id: String(requirement.id ?? `${source}-${index + 1}`).trim(),
      requirement: text,
      purpose: String(requirement.purpose ?? requirement.kind ?? "").trim() || null,
      evidencePaths: normalizeLocalPathArray(requirement.evidencePaths ?? requirement.paths),
      source
    };
  }).filter(Boolean);
}

function descriptiveContractRequirements(executionContract = {}) {
  return normalizeStringArray(plainObject(executionContract).convergence?.evidenceRequired)
    .filter((requirement) => evidenceRequirementKind(requirement) === "description");
}

function completionPolicyContext(options = {}) {
  const context = plainObject(options.context);
  const task = plainObject(context.task);
  const executionContract = plainObject(context.executionContract ?? task.executionContract);
  const requirements = [
    ...normalizeCompletionRequirements(context.requirements, "caller"),
    ...normalizeCompletionRequirements(context.evidenceRequirements, "caller-evidence"),
    ...normalizeCompletionRequirements(descriptiveContractRequirements(executionContract), "execution-contract")
  ];
  const taskLinkedPaths = explicitTaskLinkedPaths(task);
  const contractLinkedPaths = explicitContractLinkedPaths(executionContract);
  const requirementLinkedPaths = normalizeLocalPathArray(requirements.flatMap((requirement) => requirement.evidencePaths));
  const criterionLinkedPaths = normalizeLocalPathArray(
    flattenPathFields(context.verifiedCriteria, ["evidencePaths"])
  );
  return {
    task,
    executionContract,
    requirements,
    taskLinkedPaths,
    contractLinkedPaths,
    requirementLinkedPaths,
    criterionLinkedPaths,
    linkedPaths: new Set([...taskLinkedPaths, ...contractLinkedPaths, ...requirementLinkedPaths, ...criterionLinkedPaths])
  };
}

export function isExternalArtifactReference(value) {
  const text = String(value ?? "").trim();
  return /^https?:\/\/[^\s]+$/iu.test(text)
    || /^(?:doi|arxiv|source):[^\s]+$/iu.test(text)
    || /^10\.\d{4,9}\/[^\s]+$/u.test(text);
}

export function normalizeProjectRelativePath(rawPath) {
  const original = typeof rawPath === "string" ? rawPath.trim() : String(rawPath ?? "").trim();
  if (!original) {
    return { ok: false, path: original, reason: "empty path" };
  }
  if (original.includes("\0")) {
    return { ok: false, path: original, reason: "path contains a null byte" };
  }
  if (path.isAbsolute(original) || /^[A-Za-z]:[\\/]/.test(original)) {
    return { ok: false, path: original, reason: "absolute paths are not inspected" };
  }
  if (/^[a-z][a-z0-9+.-]*:/iu.test(original)) {
    return { ok: false, path: original, reason: "unsupported or malformed external reference scheme" };
  }
  const normalizedPath = path.posix.normalize(original.replace(/\\/g, "/"));
  if (normalizedPath === "." || normalizedPath === ".." || normalizedPath.startsWith("../")) {
    return { ok: false, path: original, normalizedPath, reason: "path escapes the project root" };
  }
  return { ok: true, path: original, normalizedPath };
}

function readBoundedText(fullPath, maxBytes = DEFAULT_READ_LIMIT_BYTES) {
  const descriptor = fs.openSync(fullPath, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const bytesRead = fs.readSync(descriptor, buffer, 0, maxBytes, 0);
    return {
      text: buffer.subarray(0, bytesRead).toString("utf8"),
      bytesRead
    };
  } finally {
    fs.closeSync(descriptor);
  }
}

const EXPERIMENT_RESULT_OUTCOMES = new Set(["supports", "refutes", "inconclusive", "failed", "pending"]);

const CONDITIONAL_JSON_VALIDATORS = new Map([
  [ARTIFACT_PATHS.experimentPlans, (parsed) => (
    Array.isArray(parsed?.items)
    && parsed.items.length > 0
    && parsed.items.some((item) => (
      typeof item?.methodology === "string"
      && item.methodology.trim().length > 0
      && typeof item?.successMetric === "string"
      && item.successMetric.trim().length > 0
    ))
  )],
  [ARTIFACT_PATHS.experimentResults, (parsed) => (
    Array.isArray(parsed?.items)
    && parsed.items.length > 0
    && parsed.items.some((item) => {
      const outcome = String(item?.outcome ?? "").trim().toLowerCase();
      return EXPERIMENT_RESULT_OUTCOMES.has(outcome)
        && outcome !== "pending"
        && typeof item?.summary === "string"
        && item.summary.trim().length > 0;
    })
  )]
]);

function conditionalJsonHasEvidence(relativePath, text) {
  const fields = CONDITIONAL_JSON_COLLECTION_FIELDS.get(relativePath);
  const validator = CONDITIONAL_JSON_VALIDATORS.get(relativePath);
  if (!fields && !validator) {
    return null;
  }
  try {
    const parsed = JSON.parse(text);
    return validator ? validator(parsed) : fields.some((field) => Array.isArray(parsed?.[field]) && parsed[field].length > 0);
  } catch {
    return false;
  }
}

function conditionalMarkdownHasEvidence(relativePath, text) {
  const patterns = BOOTSTRAP_MARKDOWN_PATTERNS.get(relativePath);
  if (!patterns) {
    return null;
  }
  const normalizedText = String(text ?? "").trim();
  return normalizedText.length > 0 && !patterns.some((pattern) => pattern.test(normalizedText));
}

function inspectSemanticEvidence(relativePath, text) {
  const role = artifactEvidenceRole(relativePath);
  if (["bookkeeping", "unsupported"].includes(role)) {
    return {
      role,
      satisfied: false,
      status: role,
      reason: role === "unsupported"
        ? "path is not an approved Dove completion-evidence artifact"
        : "path is a navigation, status, runtime, task, or ledger record rather than substantive work evidence"
    };
  }
  if (role !== "conditional") {
    return { role, satisfied: true, status: "existing", reason: null };
  }
  const jsonEvidence = conditionalJsonHasEvidence(relativePath, text);
  const markdownEvidence = conditionalMarkdownHasEvidence(relativePath, text);
  const satisfied = jsonEvidence ?? markdownEvidence ?? String(text ?? "").trim().length > 0;
  return satisfied
    ? { role, satisfied: true, status: "existing", reason: null }
    : {
        role,
        satisfied: false,
        status: "placeholder",
        reason: "path contains only bootstrap, placeholder, or semantically empty content"
      };
}

function readBoundedBuffer(fullPath, maxBytes = DEFAULT_READ_LIMIT_BYTES) {
  const descriptor = fs.openSync(fullPath, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const bytesRead = fs.readSync(descriptor, buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(descriptor);
  }
}

function completionMediaFormat(relativePath) {
  return COMPLETION_MEDIA_EXTENSIONS.get(path.posix.extname(String(relativePath ?? "")).toLowerCase()) ?? null;
}

function validSvgBuffer(buffer) {
  const text = buffer.toString("utf8").replace(/^﻿/u, "").trim();
  const documentText = text.replace(/^<\?xml[^>]*>\s*/iu, "");
  if (!/^<svg\b/iu.test(documentText) || !/<\/svg\s*>\s*$/iu.test(documentText)) {
    return false;
  }
  if (/<!DOCTYPE|<!ENTITY|<script\b|\bon\w+\s*=|\b(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|data:|javascript:)/iu.test(documentText)) {
    return false;
  }
  const stack = [];
  const tagPattern = /<\/?([A-Za-z_][\w:.-]*)\b[^>]*>/gu;
  for (const match of documentText.matchAll(tagPattern)) {
    const token = match[0];
    const tag = match[1].toLowerCase();
    if (token.startsWith("</")) {
      if (stack.pop() !== tag) {
        return false;
      }
    } else if (!token.endsWith("/>")) {
      stack.push(tag);
    }
  }
  return stack.length === 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngPassDimensions(width, height, interlace) {
  if (interlace === 0) {
    return [{ width, height }];
  }
  const starts = [
    [0, 0, 8, 8],
    [4, 0, 8, 8],
    [0, 4, 4, 8],
    [2, 0, 4, 4],
    [0, 2, 2, 4],
    [1, 0, 2, 2],
    [0, 1, 1, 2]
  ];
  return starts.map(([startX, startY, stepX, stepY]) => ({
    width: width <= startX ? 0 : Math.ceil((width - startX) / stepX),
    height: height <= startY ? 0 : Math.ceil((height - startY) / stepY)
  }));
}

function validPngScanlines(buffer, width, height, bitsPerPixel, interlace) {
  const passes = pngPassDimensions(width, height, interlace).filter((pass) => pass.width > 0 && pass.height > 0);
  const expectedBytes = passes.reduce((total, pass) => (
    total + pass.height * (Math.ceil((pass.width * bitsPerPixel) / 8) + 1)
  ), 0);
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0 || expectedBytes > 64 * 1024 * 1024) {
    return false;
  }
  let inflated;
  try {
    inflated = inflateSync(buffer, { maxOutputLength: expectedBytes + 1 });
  } catch {
    return false;
  }
  if (inflated.length !== expectedBytes) {
    return false;
  }
  let offset = 0;
  for (const pass of passes) {
    const rowBytes = Math.ceil((pass.width * bitsPerPixel) / 8);
    for (let row = 0; row < pass.height; row += 1) {
      if (inflated[offset] > 4) {
        return false;
      }
      offset += rowBytes + 1;
    }
  }
  return offset === inflated.length;
}

function validPngBuffer(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 57 || !buffer.subarray(0, 8).equals(signature)) {
    return false;
  }
  const allowedBitDepths = new Map([
    [0, new Set([1, 2, 4, 8, 16])],
    [2, new Set([8, 16])],
    [3, new Set([1, 2, 4, 8])],
    [4, new Set([8, 16])],
    [6, new Set([8, 16])]
  ]);
  const channelCounts = new Map([[0, 1], [2, 3], [3, 1], [4, 2], [6, 4]]);
  const criticalChunkTypes = new Set(["IHDR", "PLTE", "IDAT", "IEND"]);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = -1;
  let sawIhdr = false;
  let sawPlte = false;
  let sawIdat = false;
  let closedIdatSequence = false;
  const idatChunks = [];
  while (offset + 12 <= buffer.length) {
    const chunkLength = buffer.readUInt32BE(offset);
    const dataStart = offset + 8;
    const dataEnd = dataStart + chunkLength;
    const chunkEnd = dataEnd + 4;
    if (chunkEnd > buffer.length) {
      return false;
    }
    const typeBuffer = buffer.subarray(offset + 4, offset + 8);
    const chunkType = typeBuffer.toString("ascii");
    if (!/^[A-Za-z]{4}$/u.test(chunkType)) {
      return false;
    }
    const storedCrc = buffer.readUInt32BE(dataEnd);
    if (crc32(Buffer.concat([typeBuffer, buffer.subarray(dataStart, dataEnd)])) !== storedCrc) {
      return false;
    }
    if (chunkType[0] === chunkType[0].toUpperCase() && !criticalChunkTypes.has(chunkType)) {
      return false;
    }
    if (!sawIhdr) {
      if (chunkType !== "IHDR" || chunkLength !== 13) {
        return false;
      }
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      bitDepth = buffer[dataStart + 8];
      colorType = buffer[dataStart + 9];
      const compression = buffer[dataStart + 10];
      const filter = buffer[dataStart + 11];
      interlace = buffer[dataStart + 12];
      if (
        width <= 0
        || height <= 0
        || !allowedBitDepths.get(colorType)?.has(bitDepth)
        || compression !== 0
        || filter !== 0
        || ![0, 1].includes(interlace)
      ) {
        return false;
      }
      sawIhdr = true;
    } else if (chunkType === "IHDR") {
      return false;
    } else if (chunkType === "PLTE") {
      if (sawPlte || sawIdat || chunkLength === 0 || chunkLength % 3 !== 0 || chunkLength > 768) {
        return false;
      }
      sawPlte = true;
    } else if (chunkType === "IDAT") {
      if (closedIdatSequence || chunkLength === 0) {
        return false;
      }
      sawIdat = true;
      idatChunks.push(buffer.subarray(dataStart, dataEnd));
    } else {
      if (sawIdat && chunkType !== "IEND") {
        closedIdatSequence = true;
      }
      if (chunkType === "IEND") {
        if (
          chunkLength !== 0
          || chunkEnd !== buffer.length
          || !sawIdat
          || (colorType === 3 && !sawPlte)
        ) {
          return false;
        }
        const bitsPerPixel = channelCounts.get(colorType) * bitDepth;
        return validPngScanlines(Buffer.concat(idatChunks), width, height, bitsPerPixel, interlace);
      }
    }
    offset = chunkEnd;
  }
  return false;
}

const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf
]);

function validJpegBuffer(buffer) {
  if (buffer.length < 16 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return false;
  }
  let offset = 2;
  let sawSof = false;
  let sawSos = false;
  let sawEntropy = false;
  let sawDac = false;
  const quantizationTableIds = new Set();
  const huffmanTableIds = new Set();
  const requiredQuantizationTableIds = new Set();
  const requiredHuffmanTableIds = new Set();
  let frameComponents = new Set();
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      return false;
    }
    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset += 1;
    }
    if (offset >= buffer.length) {
      return false;
    }
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0x00 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      return false;
    }
    if (marker === 0xd9) {
      return sawSof && sawSos && sawEntropy && offset === buffer.length;
    }
    if (marker === 0x01) {
      continue;
    }
    if (offset + 2 > buffer.length) {
      return false;
    }
    const segmentLength = buffer.readUInt16BE(offset);
    const segmentEnd = offset + segmentLength;
    if (segmentLength < 2 || segmentEnd > buffer.length) {
      return false;
    }
    if (marker === 0xdb) {
      let tableOffset = offset + 2;
      while (tableOffset < segmentEnd) {
        const tableInfo = buffer[tableOffset];
        const precision = tableInfo >> 4;
        const tableId = tableInfo & 0x0f;
        const tableBytes = precision === 0 ? 64 : precision === 1 ? 128 : 0;
        if (tableId > 3 || tableBytes === 0 || tableOffset + 1 + tableBytes > segmentEnd) {
          return false;
        }
        quantizationTableIds.add(tableId);
        tableOffset += 1 + tableBytes;
      }
      if (tableOffset !== segmentEnd) {
        return false;
      }
    }
    if (marker === 0xc4) {
      let tableOffset = offset + 2;
      while (tableOffset < segmentEnd) {
        const tableInfo = buffer[tableOffset];
        const tableClass = tableInfo >> 4;
        const tableId = tableInfo & 0x0f;
        if (tableClass > 1 || tableId > 3 || tableOffset + 17 > segmentEnd) {
          return false;
        }
        let symbolCount = 0;
        for (let index = 1; index <= 16; index += 1) {
          symbolCount += buffer[tableOffset + index];
        }
        if (symbolCount === 0 || tableOffset + 17 + symbolCount > segmentEnd) {
          return false;
        }
        huffmanTableIds.add(`${tableClass}:${tableId}`);
        tableOffset += 17 + symbolCount;
      }
      if (tableOffset !== segmentEnd) {
        return false;
      }
    }
    if (marker === 0xcc) {
      sawDac = true;
    }
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (sawSof || segmentLength < 11) {
        return false;
      }
      const precision = buffer[offset + 2];
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      const componentCount = buffer[offset + 7];
      if (
        precision === 0
        || width === 0
        || height === 0
        || componentCount === 0
        || segmentLength !== 8 + 3 * componentCount
      ) {
        return false;
      }
      frameComponents = new Set();
      for (let index = 0; index < componentCount; index += 1) {
        const componentId = buffer[offset + 8 + 3 * index];
        const sampling = buffer[offset + 9 + 3 * index];
        const horizontalSampling = sampling >> 4;
        const verticalSampling = sampling & 0x0f;
        const quantizationTableId = buffer[offset + 10 + 3 * index];
        if (
          frameComponents.has(componentId)
          || horizontalSampling === 0
          || verticalSampling === 0
          || quantizationTableId > 3
        ) {
          return false;
        }
        frameComponents.add(componentId);
        requiredQuantizationTableIds.add(quantizationTableId);
      }
      sawSof = true;
    }
    if (marker !== 0xda) {
      offset = segmentEnd;
      continue;
    }
    if (!sawSof || segmentLength < 8) {
      return false;
    }
    const scanComponentCount = buffer[offset + 2];
    if (scanComponentCount === 0 || segmentLength !== 6 + 2 * scanComponentCount) {
      return false;
    }
    const scanComponents = new Set();
    for (let index = 0; index < scanComponentCount; index += 1) {
      const componentId = buffer[offset + 3 + 2 * index];
      const tableSelectors = buffer[offset + 4 + 2 * index];
      const dcTableId = tableSelectors >> 4;
      const acTableId = tableSelectors & 0x0f;
      if (
        !frameComponents.has(componentId)
        || scanComponents.has(componentId)
        || dcTableId > 3
        || acTableId > 3
      ) {
        return false;
      }
      scanComponents.add(componentId);
      requiredHuffmanTableIds.add(`0:${dcTableId}`);
      requiredHuffmanTableIds.add(`1:${acTableId}`);
    }
    if (
      [...requiredQuantizationTableIds].some((tableId) => !quantizationTableIds.has(tableId))
      || (!sawDac && [...requiredHuffmanTableIds].some((tableId) => !huffmanTableIds.has(tableId)))
    ) {
      return false;
    }
    sawSos = true;
    offset = segmentEnd;
    let scanBytes = 0;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        scanBytes += 1;
        offset += 1;
        continue;
      }
      let markerOffset = offset + 1;
      while (markerOffset < buffer.length && buffer[markerOffset] === 0xff) {
        markerOffset += 1;
      }
      if (markerOffset >= buffer.length) {
        return false;
      }
      const scanMarker = buffer[markerOffset];
      if (scanMarker === 0x00) {
        scanBytes += 1;
        offset = markerOffset + 1;
        continue;
      }
      if (scanMarker >= 0xd0 && scanMarker <= 0xd7) {
        offset = markerOffset + 1;
        continue;
      }
      if (scanBytes > 0) {
        sawEntropy = true;
      }
      offset = markerOffset - 1;
      break;
    }
  }
  return false;
}

function validPdfBuffer(buffer) {
  const text = buffer.toString("latin1");
  if (!text.startsWith("%PDF-") || !/\n%%EOF\s*$/u.test(text)) {
    return false;
  }
  const startXrefMatch = /startxref\s+(\d+)\s+%%EOF\s*$/u.exec(text);
  if (!startXrefMatch) {
    return false;
  }
  const xrefOffset = Number(startXrefMatch[1]);
  return Number.isSafeInteger(xrefOffset)
    && xrefOffset >= 0
    && xrefOffset < buffer.length
    && text.startsWith("xref", xrefOffset);
}

function completionMediaValidation(relativePath, fullPath, sizeBytes, maxBytes = DEFAULT_READ_LIMIT_BYTES) {
  const format = completionMediaFormat(relativePath);
  if (!format) {
    return null;
  }
  const requiredBytes = Math.max(maxBytes, Math.min(sizeBytes, 4 * 1024 * 1024));
  if (sizeBytes > requiredBytes) {
    return {
      satisfied: false,
      status: "malformed",
      reason: `${format.toUpperCase()} completion evidence exceeds the bounded structural validation limit`
    };
  }
  const buffer = readBoundedBuffer(fullPath, requiredBytes);
  const satisfied = format === "svg"
    ? validSvgBuffer(buffer)
    : format === "png"
      ? validPngBuffer(buffer)
      : format === "jpeg"
        ? validJpegBuffer(buffer)
        : validPdfBuffer(buffer);
  return satisfied
    ? { satisfied: true, status: "existing", reason: null }
    : {
        satisfied: false,
        status: "malformed",
        reason: `${format.toUpperCase()} completion evidence has a malformed or incomplete file structure`
      };
}

export function artifactEvidenceRole(relativePath) {
  const normalized = normalizeProjectRelativePath(relativePath);
  if (!normalized.ok) {
    return "unsupported";
  }
  const normalizedPath = normalized.normalizedPath;
  if (!normalizedPath.startsWith(`${ARTIFACT_PATHS.doveRoot}/`)) {
    return "external-project";
  }
  const declaredRole = ARTIFACT_EVIDENCE_ROLES.get(normalizedPath);
  if (declaredRole) {
    return declaredRole;
  }
  const dynamicRole = DYNAMIC_EVIDENCE_PATTERNS.find(({ pattern }) => pattern.test(normalizedPath))?.role;
  if (dynamicRole) {
    return dynamicRole;
  }
  if (
    BOOKKEEPING_ARTIFACT_PATHS.has(normalizedPath)
    || BOOKKEEPING_EVIDENCE_PATTERNS.some((pattern) => pattern.test(normalizedPath))
  ) {
    return "bookkeeping";
  }
  return "unsupported";
}

export function isBookkeepingArtifactPath(relativePath) {
  return artifactEvidenceRole(relativePath) === "bookkeeping";
}

export function inspectDeclaredPath(root, rawPath, options = {}) {
  const normalized = normalizeProjectRelativePath(rawPath);
  if (!normalized.ok) {
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath ?? null,
      status: "unsafe",
      exists: false,
      file: false,
      reason: normalized.reason
    };
  }
  const rootPath = path.resolve(root);
  const fullPath = path.resolve(rootPath, normalized.normalizedPath);
  const relativeToRoot = path.relative(rootPath, fullPath);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath,
      status: "unsafe",
      exists: false,
      file: false,
      reason: "resolved path escapes the project root"
    };
  }
  let realRootPath;
  let realFullPath;
  let canonicalRelativePath;
  let stat;
  try {
    realRootPath = fs.realpathSync(rootPath);
    realFullPath = fs.realpathSync(fullPath);
    const relativeToRealRoot = path.relative(realRootPath, realFullPath);
    if (relativeToRealRoot === ".." || relativeToRealRoot.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToRealRoot)) {
      return {
        path: normalized.path,
        normalizedPath: normalized.normalizedPath,
        status: "unsafe",
        exists: true,
        file: false,
        reason: "real path escapes the project root"
      };
    }
    canonicalRelativePath = relativeToRealRoot.split(path.sep).join("/");
    stat = fs.statSync(realFullPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        path: normalized.path,
        normalizedPath: normalized.normalizedPath,
        status: "missing",
        exists: false,
        file: false,
        reason: "path does not exist"
      };
    }
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath,
      status: "unreadable",
      exists: false,
      file: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
  if (stat.isDirectory()) {
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath,
      status: "directory",
      exists: true,
      file: false,
      sizeBytes: stat.size,
      reason: "path is a directory"
    };
  }
  if (!stat.isFile()) {
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath,
      status: "unsupported",
      exists: true,
      file: false,
      sizeBytes: stat.size,
      reason: "path is not a regular file"
    };
  }
  const declaredRole = artifactEvidenceRole(normalized.normalizedPath);
  const canonicalRole = artifactEvidenceRole(canonicalRelativePath);
  const baseItem = {
    path: normalized.path,
    normalizedPath: normalized.normalizedPath,
    canonicalRelativePath,
    evidenceRole: declaredRole,
    canonicalEvidenceRole: canonicalRole,
    status: "existing",
    exists: true,
    file: true,
    sizeBytes: stat.size
  };
  if (options.rejectBookkeeping) {
    const rejectedRole = [declaredRole, canonicalRole].find((role) => (
      role === "bookkeeping"
      || (options.requireSemanticEvidence === true && role === "unsupported")
    ));
    if (rejectedRole) {
      return {
        ...baseItem,
        status: rejectedRole,
        reason: rejectedRole === "unsupported"
          ? "path is not an approved Dove completion-evidence artifact"
          : "path is a navigation, status, runtime, task, or ledger record rather than substantive work evidence"
      };
    }
  }
  if (options.requireNonEmpty && stat.size <= 0) {
    return {
      ...baseItem,
      status: "empty",
      reason: "path is an empty file"
    };
  }
  const needsSemanticRead = options.requireSemanticEvidence === true && [declaredRole, canonicalRole].includes("conditional");
  const mediaRelativePath = options.mediaRelativePath ?? normalized.normalizedPath;
  const needsMediaValidation = options.requireValidMedia === true
    && Boolean(completionMediaFormat(mediaRelativePath) ?? completionMediaFormat(canonicalRelativePath));
  if (!options.readText && !needsSemanticRead && !needsMediaValidation) {
    return baseItem;
  }
  try {
    const mediaValidation = needsMediaValidation
      ? completionMediaValidation(
          completionMediaFormat(mediaRelativePath) ? mediaRelativePath : canonicalRelativePath,
          realFullPath,
          stat.size,
          options.maxBytes
        )
      : null;
    if (mediaValidation && !mediaValidation.satisfied) {
      return {
        ...baseItem,
        status: mediaValidation.status,
        reason: mediaValidation.reason
      };
    }
    const read = (options.readText || needsSemanticRead)
      ? readBoundedText(realFullPath, options.maxBytes ?? DEFAULT_READ_LIMIT_BYTES)
      : null;
    const semanticInspection = needsSemanticRead
      ? inspectSemanticEvidence(
          canonicalRole === "conditional" ? canonicalRelativePath : normalized.normalizedPath,
          read?.text ?? ""
        )
      : null;
    if (semanticInspection && !semanticInspection.satisfied) {
      return {
        ...baseItem,
        status: semanticInspection.status,
        reason: semanticInspection.reason,
        bytesRead: read?.bytesRead ?? 0,
        truncated: stat.size > (read?.bytesRead ?? 0)
      };
    }
    return {
      ...baseItem,
      ...(options.readText ? { text: read?.text ?? "" } : {}),
      ...(read ? { bytesRead: read.bytesRead, truncated: stat.size > read.bytesRead } : {})
    };
  } catch (error) {
    return {
      path: normalized.path,
      normalizedPath: normalized.normalizedPath,
      status: "unreadable",
      exists: true,
      file: true,
      sizeBytes: stat.size,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

export function inspectProjectArtifact(root, rawPath, options = {}) {
  return inspectDeclaredPath(root, rawPath, options);
}

function publicPathInspection(item) {
  const { text, ...publicItem } = item;
  return publicItem;
}

export function summarizePathInspections(inspections) {
  const pathsWithStatus = (status) => inspections
    .filter((item) => item.status === status)
    .map((item) => item.normalizedPath ?? item.path)
    .filter(Boolean);
  const problemStatuses = new Set(["missing", "unsafe", "unreadable", "directory", "unsupported", "unlinked", "empty", "malformed", "placeholder", "bookkeeping"]);
  return {
    declaredPaths: Array.from(new Set(inspections.map((item) => item.path).filter(Boolean))),
    inspectedPaths: Array.from(new Set(inspections.filter((item) => item.status !== "unsafe").map((item) => item.normalizedPath).filter(Boolean))),
    existingPaths: pathsWithStatus("existing"),
    missingPaths: pathsWithStatus("missing"),
    unsafePaths: pathsWithStatus("unsafe"),
    unreadablePaths: pathsWithStatus("unreadable"),
    directoryPaths: pathsWithStatus("directory"),
    unsupportedPaths: pathsWithStatus("unsupported"),
    unlinkedPaths: pathsWithStatus("unlinked"),
    emptyPaths: pathsWithStatus("empty"),
    malformedPaths: pathsWithStatus("malformed"),
    placeholderPaths: pathsWithStatus("placeholder"),
    bookkeepingPaths: pathsWithStatus("bookkeeping"),
    satisfied: inspections.some((item) => item.status === "existing"),
    problemCount: inspections.filter((item) => problemStatuses.has(item.status)).length,
    items: inspections.map(publicPathInspection)
  };
}

export function inspectPathEvidence(root, paths, options = {}) {
  return summarizePathInspections(normalizeStringArray(paths).map((item) => inspectDeclaredPath(root, item, options)));
}

export function evidencePathProblemFlags(root, paths, options = {}) {
  const evidencePaths = normalizeStringArray(paths);
  const localEvidencePaths = evidencePaths.filter((item) => !isExternalArtifactReference(item));
  const externalEvidenceRefs = evidencePaths.filter(isExternalArtifactReference);
  const pathEvidence = inspectPathEvidence(root, localEvidencePaths, {
    requireNonEmpty: true,
    rejectBookkeeping: true,
    requireSemanticEvidence: true,
    ...options
  });
  const flags = [];
  if (evidencePaths.length === 0) {
    flags.push("missing-evidence-links");
  } else if (localEvidencePaths.length === 0) {
    flags.push("missing-evidence-file");
  }
  if (pathEvidence.missingPaths.length > 0) flags.push("missing-evidence-file");
  if (pathEvidence.unsafePaths.length > 0) flags.push("unsafe-evidence-path");
  if (pathEvidence.unreadablePaths.length > 0) flags.push("unreadable-evidence-file");
  if (pathEvidence.directoryPaths.length > 0) flags.push("directory-evidence-file");
  if (pathEvidence.unsupportedPaths.length > 0) flags.push("unsupported-evidence-file");
  if (pathEvidence.emptyPaths.length > 0) flags.push("empty-evidence-file");
  if (pathEvidence.malformedPaths.length > 0) flags.push("malformed-evidence-file");
  if (pathEvidence.placeholderPaths.length > 0) flags.push("placeholder-evidence-file");
  if (pathEvidence.bookkeepingPaths.length > 0) flags.push("bookkeeping-evidence-file");
  return {
    evidencePaths,
    localEvidencePaths,
    externalEvidenceRefs,
    pathEvidence,
    flags: Array.from(new Set(flags)),
    satisfied: pathEvidence.satisfied && pathEvidence.problemCount === 0
  };
}

export function pathProblems(summary) {
  return [
    ...summary.missingPaths,
    ...summary.unsafePaths,
    ...summary.unreadablePaths,
    ...summary.directoryPaths,
    ...summary.unsupportedPaths,
    ...(summary.unlinkedPaths ?? []),
    ...summary.emptyPaths,
    ...summary.malformedPaths,
    ...summary.placeholderPaths,
    ...summary.bookkeepingPaths
  ];
}

function criteriaEvidenceIntegrity(root, verifiedCriteria, options = {}) {
  const criteria = Array.isArray(verifiedCriteria) ? verifiedCriteria : [];
  return criteria.map((criterion) => {
    const evidencePaths = normalizeStringArray(criterion?.evidencePaths);
    const localEvidencePaths = evidencePaths.filter((item) => !isExternalArtifactReference(item));
    const externalEvidenceRefs = evidencePaths.filter(isExternalArtifactReference);
    const pathEvidence = inspectPathEvidence(root, localEvidencePaths, options);
    return {
      criterion: criterion?.criterion ?? null,
      status: criterion?.status ?? null,
      evidencePaths,
      localEvidencePaths,
      externalEvidenceRefs,
      pathEvidence,
      satisfied: pathEvidence.satisfied,
      problemPaths: pathProblems(pathEvidence)
    };
  });
}

function completionPathApproval(relativePath, canonicalRelativePath, policy) {
  const normalizedPath = normalizeLocalPath(relativePath);
  const canonicalPath = normalizeLocalPath(canonicalRelativePath) ?? normalizedPath;
  const workflowGoalRole = WORKFLOW_GOAL_COMPLETION_EVIDENCE_ROLES.get(normalizedPath) ?? null;
  if (workflowGoalRole && canonicalPath === normalizedPath) {
    return { approved: true, role: workflowGoalRole, linkage: "workflow-goal-fixed" };
  }
  if (policy.linkedPaths.has(normalizedPath)) {
    return {
      approved: true,
      role: artifactEvidenceRole(canonicalPath),
      linkage: policy.contractLinkedPaths.includes(normalizedPath)
        ? "execution-contract"
        : policy.requirementLinkedPaths.includes(normalizedPath)
          ? "requirement"
          : policy.criterionLinkedPaths.includes(normalizedPath)
            ? "verified-criterion"
            : "task"
    };
  }
  const role = artifactEvidenceRole(canonicalPath);
  if (DYNAMIC_COMPLETION_EVIDENCE_PATTERN.test(normalizedPath ?? "")) {
    return {
      approved: false,
      role,
      linkage: null,
      reason: "dynamic .dove/evidence paths require an exact task, execution-contract, or requirement link"
    };
  }
  if (role === "external-project") {
    return {
      approved: false,
      role,
      linkage: null,
      reason: "repository files outside .dove require an exact task, execution-contract, or requirement link"
    };
  }
  return { approved: true, role, linkage: "approved-dove-role" };
}

function applyCompletionPathPolicy(root, inspection, policy, inspectOptions) {
  if (inspection.status !== "existing") {
    return inspection;
  }
  const rejectedRole = [inspection.evidenceRole, inspection.canonicalEvidenceRole].find((role) => role === "bookkeeping")
    ?? ([inspection.evidenceRole, inspection.canonicalEvidenceRole].every((role) => role === "unsupported") ? "unsupported" : null);
  if (rejectedRole) {
    return {
      ...inspection,
      status: rejectedRole,
      reason: rejectedRole === "unsupported"
        ? "path is not an approved Dove completion-evidence artifact"
        : "path is a navigation, status, runtime, task, or ledger record rather than substantive work evidence"
    };
  }
  const approval = completionPathApproval(
    inspection.normalizedPath,
    inspection.canonicalRelativePath,
    policy
  );
  if (!approval.approved) {
    return {
      ...inspection,
      status: "unlinked",
      completionEvidenceRole: approval.role,
      completionLinkage: null,
      reason: approval.reason
    };
  }
  const mediaFormat = completionMediaFormat(inspection.normalizedPath)
    ?? completionMediaFormat(inspection.canonicalRelativePath);
  if (mediaFormat) {
    const mediaInspection = inspectDeclaredPath(root, inspection.normalizedPath, {
      ...inspectOptions,
      requireValidMedia: true,
      mediaRelativePath: inspection.normalizedPath
    });
    if (mediaInspection.status !== "existing") {
      return {
        ...mediaInspection,
        completionEvidenceRole: approval.role,
        completionLinkage: approval.linkage
      };
    }
  }
  return {
    ...inspection,
    completionEvidenceRole: approval.role,
    completionLinkage: approval.linkage
  };
}

function completionPathEvidence(root, paths, policy, inspectOptions) {
  const inspections = normalizeStringArray(paths).map((item) => {
    const inspection = inspectDeclaredPath(root, item, {
      ...inspectOptions,
      rejectBookkeeping: false
    });
    return applyCompletionPathPolicy(root, inspection, policy, inspectOptions);
  });
  const summary = summarizePathInspections(inspections);
  return {
    ...summary,
    items: inspections.map(publicPathInspection)
  };
}

function completionPathProblems(summary) {
  return pathProblems(summary);
}

function criterionExpectsNegativeOutcome(value) {
  const criterion = String(value ?? "").trim();
  return /^(?:blocked|failed|held|negative|rejected|unresolved|incomplete)\b/iu.test(criterion)
    || /\b(?:must|should|is|remains?|returns?|records?|reports?|shows?|surfaces?)\s+(?:be\s+)?(?:blocked|failed|held|negative|rejected|unresolved|incomplete)\b/iu.test(criterion)
    || /\b(?:reject|block|hold|surface|report|record)\w*\b[^.]{0,80}\b(?:failure|blocked|failed|held|negative|rejected|unresolved|incomplete)\b/iu.test(criterion);
}

function positiveCriterion(criterion) {
  const status = String(criterion?.status ?? "").trim().toLowerCase();
  return ["met", "passed", "verified"].includes(status)
    && !criterionExpectsNegativeOutcome(criterion?.criterion);
}

function normalizedStatus(value) {
  return String(value ?? "").trim().toLowerCase();
}

function collectValidationSignals(value, pointer = "$", depth = 0, seen = new Set()) {
  if (depth > 8 || value === null || value === undefined) {
    return [];
  }
  if (typeof value !== "object") {
    return [];
  }
  if (seen.has(value)) {
    return [];
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectValidationSignals(item, `${pointer}[${index}]`, depth + 1, seen));
  }
  const signals = [];
  for (const [key, item] of Object.entries(value)) {
    const itemPointer = `${pointer}.${key}`;
    const normalizedKey = key.toLowerCase();
    if (
      typeof item === "string"
      && (
        /(?:status|verdict|readiness)$/u.test(normalizedKey)
        || /(?:validation|verification|qa|review|comparison)(?:outcome|mapping)$/u.test(normalizedKey)
      )
    ) {
      const status = normalizedStatus(item);
      if (NEGATIVE_VALIDATION_STATUSES.has(status) || POSITIVE_VALIDATION_STATUSES.has(status)) {
        signals.push({ pointer: itemPointer, field: key, status });
      }
    }
    if (typeof item === "boolean" && /(?:complete|completed|passed|ready|resolved|satisfied|valid)$/u.test(normalizedKey)) {
      signals.push({ pointer: itemPointer, field: key, status: item ? "positive" : "incomplete" });
    }
    if (Array.isArray(item) && item.length > 0 && /(?:issues|openissues|openissueids|unresolved|unresolvedconcerns|unresolvedconcernids|integrityflags|missing|missingartifactrefs|missingrequirementids)$/u.test(normalizedKey.replace(/[^a-z]/gu, ""))) {
      signals.push({ pointer: itemPointer, field: key, status: "unresolved", count: item.length });
    }
    if (item && typeof item === "object") {
      signals.push(...collectValidationSignals(item, itemPointer, depth + 1, seen));
    }
  }
  return signals;
}

function parseValidationArtifact(item) {
  if (item.status !== "existing") {
    return null;
  }
  const canonicalPath = item.canonicalRelativePath ?? item.normalizedPath;
  if (path.posix.extname(canonicalPath ?? "").toLowerCase() !== ".json") {
    return null;
  }
  try {
    return JSON.parse(item.text ?? "");
  } catch {
    return null;
  }
}

function structuredTextValidationSignals(text) {
  const signals = [];
  const lines = String(text ?? "").split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const fieldMatch = /^[-*]?\s*(?:qa\s+)?(?:status|verdict|outcome|readiness|mapping|review verdict|comparison status|audit verdict|bridge status)\s*:\s*([^\s,;]+)/iu.exec(line);
    if (fieldMatch) {
      const status = normalizedStatus(fieldMatch[1]);
      if (NEGATIVE_VALIDATION_STATUSES.has(status) || POSITIVE_VALIDATION_STATUSES.has(status)) {
        signals.push({ pointer: `$text[${index + 1}]`, field: "structured-text", status });
      }
    }
    const unresolvedMatch = /^[-*]?\s*(?:unresolved concerns?|open issues?)\s*:\s*(.+)$/iu.exec(line);
    if (unresolvedMatch && !/^(?:none|no(?:ne)?|0|\[\])\.?$/iu.test(unresolvedMatch[1].trim())) {
      signals.push({ pointer: `$text[${index + 1}]`, field: "structured-text", status: "unresolved" });
    }
  }
  return signals;
}

function negativeOutcomeInspection(root, criterion, pathEvidence, inspectOptions) {
  if (!positiveCriterion(criterion)) {
    return { contradictory: false, paths: [], signals: [] };
  }
  const negativePaths = [];
  const signals = [];
  for (const item of pathEvidence.items ?? []) {
    if (item.status !== "existing") {
      continue;
    }
    const canonicalPath = item.canonicalRelativePath ?? item.normalizedPath;
    const role = item.completionEvidenceRole ?? artifactEvidenceRole(canonicalPath);
    if (!["conditional", "validation"].includes(role)) {
      continue;
    }
    const withText = inspectDeclaredPath(root, item.normalizedPath, { ...inspectOptions, readText: true });
    const parsed = parseValidationArtifact(withText);
    const itemSignals = parsed
      ? collectValidationSignals(parsed)
      : structuredTextValidationSignals(withText.text);
    const negativeSignals = itemSignals.filter((signal) => NEGATIVE_VALIDATION_STATUSES.has(signal.status));
    if (negativeSignals.length > 0) {
      negativePaths.push(item.normalizedPath);
      signals.push(...negativeSignals.map((signal) => ({ ...signal, path: item.normalizedPath })));
    }
  }
  return {
    contradictory: negativePaths.length > 0,
    paths: Array.from(new Set(negativePaths)),
    signals
  };
}

function requirementPurpose(requirement) {
  if (requirement.purpose) {
    return requirement.purpose.toLowerCase();
  }
  return Array.from(REQUIREMENT_PURPOSE_PATTERNS.entries())
    .find(([, pattern]) => pattern.test(requirement.requirement))?.[0] ?? "unspecified";
}

function evidencePurpose(item) {
  const relativePath = String(item.canonicalRelativePath ?? item.normalizedPath ?? "");
  if (relativePath === ARTIFACT_PATHS.experimentAudits) return "audit";
  if (relativePath === ARTIFACT_PATHS.claimBridgeLog) return "bridge";
  if (relativePath === ARTIFACT_PATHS.figureQa) return "qa";
  if ([ARTIFACT_PATHS.reviewLog, ARTIFACT_PATHS.reviewReport, ARTIFACT_PATHS.reviewConcerns, ARTIFACT_PATHS.reviewDebateLog].includes(relativePath)) return "review";
  if ([ARTIFACT_PATHS.versionComparisons, ARTIFACT_PATHS.versionComparisonReport].includes(relativePath)) return "comparison";
  const role = item.completionEvidenceRole ?? item.evidenceRole;
  if (role === "validation") return "validation";
  if (role === "substantive" || role === "external-project") return "artifact";
  return "evidence";
}

function requirementCoverage(policy, pathEvidence) {
  const available = (pathEvidence.items ?? []).filter((item) => item.status === "existing");
  const usedEvidenceFiles = new Set();
  const coverage = policy.requirements.map((requirement) => {
    const requiredPurpose = requirementPurpose(requirement);
    const exactPaths = new Set(requirement.evidencePaths);
    const matched = available.find((item) => {
      const evidenceFile = item.canonicalRelativePath ?? item.normalizedPath;
      if (usedEvidenceFiles.has(evidenceFile)) {
        return false;
      }
      if (exactPaths.size > 0) {
        return exactPaths.has(item.normalizedPath);
      }
      const itemPurpose = evidencePurpose(item);
      return requiredPurpose === "unspecified"
        ? false
        : requiredPurpose === itemPurpose
          || (requiredPurpose === "evidence" && ["artifact", "validation"].includes(itemPurpose));
    });
    if (matched) {
      usedEvidenceFiles.add(matched.canonicalRelativePath ?? matched.normalizedPath);
    }
    return {
      id: requirement.id,
      requirement: requirement.requirement,
      purpose: requiredPurpose,
      source: requirement.source,
      requiredEvidencePaths: requirement.evidencePaths,
      covered: Boolean(matched),
      evidencePath: matched?.normalizedPath ?? null,
      evidencePurpose: matched ? evidencePurpose(matched) : null
    };
  });
  return {
    coverage,
    uncoveredRequirements: coverage.filter((item) => !item.covered),
    coveredRequirements: coverage.filter((item) => item.covered)
  };
}

export function completionEvidenceIntegrity(root, evidence = {}, options = {}) {
  const inspectOptions = {
    requireNonEmpty: true,
    rejectBookkeeping: true,
    requireSemanticEvidence: true,
    ...(options.inspectOptions ?? {})
  };
  const policy = completionPolicyContext(options);
  const eligibleSourceReferences = new Set(normalizeStringArray(options.context?.eligibleSourceReferences));
  const evidencePaths = normalizeStringArray(evidence.evidencePaths);
  const localEvidencePaths = evidencePaths.filter((item) => !isExternalArtifactReference(item));
  const externalEvidenceRefs = evidencePaths.filter(isExternalArtifactReference);
  const sourceEvidenceRefs = externalEvidenceRefs.filter((item) => item.startsWith("source:"));
  const eligibleSourceEvidenceRefs = sourceEvidenceRefs.filter((item) => eligibleSourceReferences.has(item));
  const pathEvidence = completionPathEvidence(root, localEvidencePaths, policy, inspectOptions);
  const criteria = (Array.isArray(evidence.verifiedCriteria) ? evidence.verifiedCriteria : []).map((criterion) => {
    const criterionEvidencePaths = normalizeStringArray(criterion?.evidencePaths);
    const criterionLocalEvidencePaths = criterionEvidencePaths.filter((item) => !isExternalArtifactReference(item));
    const criterionExternalEvidenceRefs = criterionEvidencePaths.filter(isExternalArtifactReference);
    const criterionEligibleSourceEvidenceRefs = criterionExternalEvidenceRefs
      .filter((item) => item.startsWith("source:"))
      .filter((item) => eligibleSourceReferences.has(item));
    const criterionPathEvidence = completionPathEvidence(root, criterionLocalEvidencePaths, policy, inspectOptions);
    const negativeOutcome = negativeOutcomeInspection(root, criterion, criterionPathEvidence, inspectOptions);
    return {
      criterion: criterion?.criterion ?? null,
      status: criterion?.status ?? null,
      evidencePaths: criterionEvidencePaths,
      localEvidencePaths: criterionLocalEvidencePaths,
      externalEvidenceRefs: criterionExternalEvidenceRefs,
      eligibleSourceEvidenceRefs: criterionEligibleSourceEvidenceRefs,
      pathEvidence: criterionPathEvidence,
      negativeOutcome,
      satisfied: (criterionPathEvidence.satisfied || criterionEligibleSourceEvidenceRefs.length > 0)
        && criterionPathEvidence.problemCount === 0
        && negativeOutcome.contradictory === false,
      problemPaths: completionPathProblems(criterionPathEvidence)
    };
  });
  const missingCriteriaEvidence = criteria.filter((item) => !item.satisfied);
  const problemPaths = completionPathProblems(pathEvidence);
  const requirementIntegrity = requirementCoverage(policy, pathEvidence);
  const uncoveredRequirements = requirementIntegrity.uncoveredRequirements;
  const existingEvidencePaths = pathEvidence.existingPaths.filter((item) => !(pathEvidence.unlinkedPaths ?? []).includes(item));
  const substantiveEvidencePaths = [...existingEvidencePaths, ...eligibleSourceEvidenceRefs];
  return {
    declaredPaths: evidencePaths,
    localEvidencePaths,
    externalEvidenceRefs,
    eligibleSourceEvidenceRefs,
    pathEvidence,
    existingEvidencePaths,
    substantiveEvidencePaths,
    problemPaths,
    criteria,
    missingCriteriaEvidence,
    requirementCoverage: requirementIntegrity.coverage,
    coveredRequirements: requirementIntegrity.coveredRequirements,
    uncoveredRequirements,
    semanticContext: {
      taskId: policy.task.id ?? policy.task.packetId ?? null,
      taskLinkedPaths: policy.taskLinkedPaths,
      contractLinkedPaths: policy.contractLinkedPaths,
      requirementLinkedPaths: policy.requirementLinkedPaths
    },
    satisfied: (pathEvidence.satisfied || eligibleSourceEvidenceRefs.length > 0)
      && missingCriteriaEvidence.length === 0
      && problemPaths.length === 0
      && uncoveredRequirements.length === 0,
    hasSubstantiveEvidence: substantiveEvidencePaths.length > 0 && problemPaths.length === 0
  };
}
