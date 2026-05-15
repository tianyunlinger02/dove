import fs from "node:fs";
import path from "node:path";

import { loadDoveLanguageConfig, loadExplicitDoveLanguageConfig } from "./config.mjs";
import { ARTIFACT_PATHS, DEFAULT_DOVE_RESPONSE_LANGUAGE, normalizeDoveResponseLanguage, normalizeState } from "./schema.mjs";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstExplicitLanguage(...sources) {
  for (const source of sources) {
    if (!isPlainObject(source)) {
      continue;
    }
    const value = source.responseLanguage ?? source.language;
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return null;
}

function readStateLanguage(root) {
  if (!root) {
    return null;
  }
  const statePath = path.join(root, ARTIFACT_PATHS.state);
  if (!fs.existsSync(statePath)) {
    return null;
  }
  try {
    const state = normalizeState(JSON.parse(fs.readFileSync(statePath, "utf8")));
    return state.settings?.responseLanguage ?? null;
  } catch {
    return null;
  }
}

export function resolveDoveResponseLanguage(root, args = {}, options = {}) {
  const argLanguage = firstExplicitLanguage(args, args.settings);
  if (argLanguage) {
    return normalizeDoveResponseLanguage(argLanguage, DEFAULT_DOVE_RESPONSE_LANGUAGE, { strict: true });
  }

  const env = options.env ?? process.env;
  const configLanguage = options.configLanguage ?? loadExplicitDoveLanguageConfig(root, env);
  if (configLanguage) {
    return configLanguage;
  }

  const stateLanguage = options.state?.settings?.responseLanguage ?? readStateLanguage(root);
  if (stateLanguage) {
    return normalizeDoveResponseLanguage(stateLanguage, DEFAULT_DOVE_RESPONSE_LANGUAGE);
  }

  return loadDoveLanguageConfig(root, env);
}

export function isDoveChinese(language) {
  return normalizeDoveResponseLanguage(language) === "zh";
}

const TEXT = {
  taskFallbackTitle: {
    zh: "Dove 任务",
    en: "Dove task"
  },
  missionFallbackTitle: {
    zh: "Dove 任务",
    en: "Dove mission"
  },
  executePlannedWork: {
    zh: "执行已规划的 Dove 工作",
    en: "Execute planned Dove work"
  },
  childMissionFallback: {
    zh: ({ title }) => `${title} 子任务`,
    en: ({ title }) => `${title} child`
  },
  checklistItem: {
    zh: ({ index }) => `检查项 ${index}`,
    en: ({ index }) => `Checklist item ${index}`
  },
  checklistClarifyTitle: {
    zh: "澄清范围与验收证据",
    en: "Clarify scope and acceptance evidence"
  },
  checklistClarifySummary: {
    zh: "确认任务范围、阻塞项、目标产物和证据期望。",
    en: "Confirm the task scope, blockers, artifact targets, and evidence expectations."
  },
  checklistWorkTitle: {
    zh: "执行核心任务工作",
    en: "Perform the core mission work"
  },
  checklistWorkSummary: {
    zh: "通过合适的顶层工作流完成分类后的 Dove 任务。",
    en: "Carry out the classified Dove task through the appropriate top-level workflow."
  },
  checklistReviewTitle: {
    zh: "运行独立审查并记录发现",
    en: "Run independent review and record findings"
  },
  checklistValidateTitle: {
    zh: "验证证据并记录完成状态",
    en: "Validate evidence and record completion state"
  },
  checklistValidateSummary: {
    zh: "关闭前对照声明的证据期望检查产物。",
    en: "Check the produced artifacts against the declared evidence expectations before closure."
  },
  initNextActionDisplay: {
    zh: "运行 project:dove.mission，在 init 目标下创建下一个任务。",
    en: "Run project:dove.mission to create the next task under the init goal."
  },
  createTaskConfirmMessage: {
    zh: "请先批准这份需求到任务的任务契约，然后 Dove 才会将其物化并运行一次有边界的前台执行。",
    en: "Approve this demand-to-task mission contract before Dove materializes it and runs one bounded foreground pass."
  },
  createTaskMaterializedMessage: {
    zh: "已批准的需求到任务契约已经物化。现在执行一次有边界的前台任务，然后记录任务执行结果。",
    en: "The approved demand-to-task mission contract is materialized. Execute one bounded foreground pass now, then record the mission pass result."
  },
  missionPassSelectMessage: {
    zh: "记录任务执行结果前，请先通过 index 或 packetId 选择一个持久任务。",
    en: "Select a durable task by index or packetId before recording the mission pass."
  },
  missionPassCompletedSummary: {
    zh: "任务执行已完成。",
    en: "Mission pass completed."
  },
  missionPassBlockedSummary: {
    zh: "任务执行遇到阻塞。",
    en: "Mission pass reached a blocker."
  },
  missionPassProgressSummary: {
    zh: "任务执行已记录进展。",
    en: "Mission pass recorded progress."
  },
  killSelectMessage: {
    zh: "杀死任务前，请先通过 index 或 packetId 选择一个非 init 任务。",
    en: "Select a non-init task by index or packetId before killing it."
  },
  killReason: {
    zh: "操作者杀死了该任务。",
    en: "Operator killed this task."
  },
  lifecycleKillReason: {
    zh: "操作者将该任务标记为 killed。",
    en: "Operator marked this task killed."
  },
  statusAdjustConfirmMessage: {
    zh: "在持久任务生命周期状态变更前，请确认选中的 Dove 任务状态调整。",
    en: "Confirm the selected Dove task status adjustments before durable task lifecycle state changes."
  },
  statusAdjustMissingReason: {
    zh: "每个调整都需要 packetId 和一个有效的 Dove 任务状态。",
    en: "Each adjustment requires packetId and one valid Dove task status."
  },
  statusAdjustNoPacketReason: {
    zh: "没有持久任务包匹配该 packetId。",
    en: "No durable task packet matches this packetId."
  },
  statusAdjustInitReason: {
    zh: "level-0 init 任务不能通过状态 UX 调整。",
    en: "The level-0 init task is not adjusted through status UX."
  },
  statusAdjustSameReason: {
    zh: "任务已经处于请求的状态。",
    en: "Task already has the requested status."
  },
  blockerTitle: {
    zh: ({ title }) => `调查 ${title} 的阻塞原因`,
    en: ({ title }) => `Investigate blocker for ${title}`
  },
  blockerSummary: {
    zh: ({ title }) => `找出并解释阻止 ${title} 继续推进的原因。`,
    en: ({ title }) => `Find and explain the blocker preventing ${title} from advancing.`
  },
  blockerEvidenceWhy: {
    zh: ({ id }) => `解释 ${id} 为什么被阻塞`,
    en: ({ id }) => `Explain why ${id} is blocked`
  },
  blockerEvidenceAction: {
    zh: "建议下一状态或具体解除阻塞动作",
    en: "Recommend the next state or concrete unblock action"
  },
  operatorConfirmMessage: {
    zh: "请先确认，然后 Dove operator 才会为 ready/in-progress 任务记录一次前台执行，并为阻塞任务创建阻塞调查计划任务。",
    en: "Confirm before Dove operator records one foreground pass for ready/in-progress missions and creates blocker-investigation plan missions."
  },
  operatorAwaitingStopReason: {
    zh: "未提供主机侧任务结果，因此 Dove 不声称已经执行。",
    en: "No host-supplied task result was provided, so Dove did not claim execution."
  },
  operatorResultSummary: {
    zh: "已记录 operator 执行结果。",
    en: "Operator pass result recorded."
  },
  versionReason: {
    zh: "方向已变更。",
    en: "Direction changed."
  },
  versionTitle: {
    zh: "Dove 方向重置",
    en: "Dove direction reset"
  },
  versionNextActionDisplay: {
    zh: "运行 project:dove.mission 处理下一个方向。",
    en: "Run project:dove.mission for the next direction."
  },
  autoSelectionConfirmMessage: {
    zh: "请先批准选中的持久任务，然后 /dove:auto 才会运行有边界的前台迭代。",
    en: "Approve the selected durable task before /dove:auto runs bounded foreground iterations."
  },
  autoDemandConfirmMessage: {
    zh: "请先批准这份需求到任务的 auto 契约，然后 Dove 才会将其物化并运行有边界的前台迭代。",
    en: "Approve this demand-to-task auto contract before Dove materializes it and runs bounded foreground iterations."
  },
  autoSelectExistingMessage: {
    zh: "在 /dove:auto 运行前，请使用确认 UX 通过 index 或 packetId 选择一个现有持久任务。",
    en: "Use confirmation UX to select an existing durable task by index or packetId before /dove:auto runs."
  },
  autoSelectOrDemandMessage: {
    zh: "在 /dove:auto 运行前，请使用确认 UX 选择一个持久任务，或提供一个新需求。",
    en: "Use confirmation UX to select a durable task or provide a new demand before /dove:auto runs."
  },
  autoSelectExistingConfirmedMessage: {
    zh: "在 /dove:auto 运行前，请通过 index 或 packetId 选择一个现有持久任务。",
    en: "Select an existing durable task by index or packetId before /dove:auto runs."
  },
  autoProvideTargetMessage: {
    zh: "在 /dove:auto 运行前，请提供任务目标或新目标。",
    en: "Provide a task target or a new goal before /dove:auto runs."
  },
  autoNoStepStopReason: {
    zh: "本次 auto 迭代未提供具体且安全的工作流步骤。",
    en: "No concrete safe workflow step was supplied for this auto iteration."
  },
  defaultDoveTitle: {
    zh: "未命名任务工作区",
    en: "Untitled Mission Workspace"
  },
  defaultDoveObjective: {
    zh: "记录 Dove 任务目标与贡献。",
    en: "Capture the Dove mission goal and contribution."
  },
  defaultDoveThesis: {
    zh: "用一句话描述论文领域主张或任务结果。",
    en: "Describe the paper-domain claim or mission outcome in one sentence."
  },
  defaultCurrentFocus: {
    zh: "对齐看板并选择下一个持久步骤。",
    en: "Align the board and choose the next durable step."
  },
  queryFallbackGoal: {
    zh: "从当前工作区界定一个有边界的 Dove 任务。",
    en: "Frame one bounded Dove mission from the current workspace."
  },
  returnProtocol: {
    zh: ({ checks }) => `返回时携带 ${checks}。`,
    en: ({ checks }) => `Return with ${checks}.`
  },
  routeSelectedReason: {
    zh: ({ selectedCommand, nextCommand }) => `为了得到确定性的、无写入的 Dove 路由结果，从领域路由 ${nextCommand} 中选择了 ${selectedCommand}。`,
    en: ({ selectedCommand, nextCommand }) => `Selected ${selectedCommand} from domain route ${nextCommand} for a deterministic no-write Dove routing result.`
  },
  routeAutoReason: {
    zh: "本次 Dove 路由查询已显式允许自动执行。",
    en: "Auto execution was explicitly allowed for this Dove routing query."
  },
  routeDefaultReason: {
    zh: ({ stage, domain, selectedCommand }) => `领域 ${domain} 的任务阶段 ${stage} 映射到 ${selectedCommand}。`,
    en: ({ stage, domain, selectedCommand }) => `Mission stage ${stage} in domain ${domain} maps to ${selectedCommand}.`
  },
  projectTitleFallback: {
    zh: "Dove 项目",
    en: "Dove project"
  },
  boardBlockerFallback: {
    zh: ({ index }) => `看板阻塞 ${index}`,
    en: ({ index }) => `Board blocker ${index}`
  },
  taskBlockedBySummary: {
    zh: ({ id, blockers }) => `${id} 被 ${blockers} 阻塞`,
    en: ({ id, blockers }) => `${id} is blocked by ${blockers}`
  },
  taskMarkedBlockedSummary: {
    zh: ({ id }) => `${id} 被标记为 blocked`,
    en: ({ id }) => `${id} is marked blocked`
  },
  returnReadyVerdict: {
    zh: "基于当前持久证据，返回已就绪。",
    en: "Return is ready from the current durable evidence."
  },
  returnNotReadyVerdict: {
    zh: "返回尚未就绪；关闭前请先执行下一个 Dove 命令。",
    en: "Return is not ready; follow the next Dove command before closure."
  },
  lessonRitualWhen: {
    zh: "返回已就绪且有值得保留的可复用经验之后",
    en: "after return is ready and reusable experience is worth preserving"
  }
};

export function doveText(language, key, params = {}) {
  const normalized = normalizeDoveResponseLanguage(language);
  const entry = TEXT[key];
  const value = entry?.[normalized] ?? entry?.en ?? key;
  return typeof value === "function" ? value(params) : value;
}
