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
  executePlannedWork: {
    zh: "执行已规划的 Dove 工作",
    en: "Execute planned Dove work"
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
  workContractPurpose: {
    zh: ({ title, stage, domain }) => `把“${title}”转成可执行、可验证、可续接的 ${stage}/${domain} 工作合同。`,
    en: ({ title, stage, domain }) => `Turn “${title}” into an executable, verifiable, resumable ${stage}/${domain} work contract.`
  },
  workContractDeliverablesPlan: {
    zh: ({ title }) => [`${title} 的可执行计划和拆分后的后续任务。`, "明确证据缺口、阻塞条件和下一步路线。"],
    en: ({ title }) => [`An executable plan for ${title} with follow-up tasks.`, "Explicit evidence gaps, blockers, and next routes."]
  },
  workContractDeliverablesPaper: {
    zh: ({ title }) => [`${title} 对应的草稿、改写或论文产物。`, "支撑该产物的 source、note、claim、figure 或 review 证据引用。"],
    en: ({ title }) => [`A draft, revision, or paper artifact for ${title}.`, "Source, note, claim, figure, or review evidence references supporting the artifact."]
  },
  workContractDeliverablesExperiment: {
    zh: ({ title }) => [`${title} 的实验计划、结果或审计记录。`, "把实验结果桥接到 claim 或明确不能桥接的原因。"],
    en: ({ title }) => [`An experiment plan, result, or audit record for ${title}.`, "A bridge from result to claim, or an explicit reason it cannot be bridged."]
  },
  workContractDeliverablesAudit: {
    zh: ({ title }) => [`${title} 的独立检查结论。`, "可执行的修订项、证据缺口或阻塞边界。"],
    en: ({ title }) => [`Independent review findings for ${title}.`, "Actionable revisions, evidence gaps, or blocker boundaries."]
  },
  workContractDeliverablesEngineering: {
    zh: ({ title }) => [`${title} 对应的代码、配置、文档或测试改动。`, "能复现实质进展的验证证据。"],
    en: ({ title }) => [`Code, configuration, documentation, or test changes for ${title}.`, "Validation evidence that proves real progress."]
  },
  workContractEvidenceDefault: {
    zh: "列出实际修改、产物路径、测试/验证输出，或记录无法继续的明确边界。",
    en: "List actual changes, artifact paths, test/validation output, or an explicit boundary that blocks continuation."
  },
  workContractDoneDefault: {
    zh: "交付物已经产出，证据可以被 status/review 追踪，且下一步不是重新解释需求。",
    en: "Deliverables exist, evidence is traceable by status/review, and the next step is not re-explaining the demand."
  },
  workContractOutOfScopeDefault: {
    zh: ["不虚构实验、论文、review 或工程结果。", "不在没有真实证据时把任务标记 completed。", "不启动隐藏后台执行、daemon 或 scheduler。"],
    en: ["Do not fabricate experiment, paper, review, or engineering results.", "Do not mark the task completed without real evidence.", "Do not start hidden background execution, daemons, or schedulers."]
  },
  workContractImpactPlan: {
    zh: "把模糊方向切成可执行任务，后续 status 能直接显示该做哪一步。",
    en: "Turns a vague direction into executable tasks so status can show the next concrete step."
  },
  workContractImpactPaper: {
    zh: "把论文推进绑定到可检查的草稿/证据产物，减少只创建任务但不知道怎么写的情况。",
    en: "Binds paper progress to inspectable draft/evidence artifacts instead of creating a task with no writing path."
  },
  workContractImpactExperiment: {
    zh: "把实验推进绑定到计划、结果、审计和 claim 桥接，避免只记录想法。",
    en: "Binds experiment progress to planning, results, audit, and claim bridging instead of only recording an idea."
  },
  workContractImpactAudit: {
    zh: "把检查结果转成可修订、可验证的下一步，而不是停在泛泛 review。",
    en: "Turns review into actionable, verifiable revision steps instead of generic feedback."
  },
  workContractImpactEngineering: {
    zh: "把工程需求绑定到改动和验证证据，status 可以继续推进而不是只展示任务名。",
    en: "Binds engineering work to changes and validation evidence so status can continue the work instead of only showing a task name."
  },
  workContractRoutePrimaryLabel: {
    zh: "首选推进路线",
    en: "Primary route"
  },
  workContractRoutePrimaryWhen: {
    zh: "需要按合同产出第一批真实交付物和证据时使用。",
    en: "Use when producing the first real deliverables and evidence for the contract."
  },
  workContractRouteAutoLabel: {
    zh: "多轮自动推进",
    en: "Multi-round auto route"
  },
  workContractRouteAutoWhen: {
    zh: "已有任务合同，想让 Dove 在前台多轮推进直到完成或边界时使用。",
    en: "Use when a task contract exists and Dove should run foreground iterations until completion or a boundary."
  },
  workContractRouteReviewLabel: {
    zh: "审查/验收路线",
    en: "Review route"
  },
  workContractRouteReviewWhen: {
    zh: "需要独立检查证据、草稿、结果或完成状态时使用。",
    en: "Use when evidence, drafts, results, or completion state need independent review."
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
    zh: "请先确认，然后 Dove operator 只会运行安全内部步骤、记录你显式提供的 host 结果，或为阻塞任务创建调查计划；缺少 host 结果的任务会保持不变并返回所需证据。",
    en: "Confirm before Dove operator runs only safe internal steps, records explicitly supplied host results, or creates blocker-investigation plan missions; missions missing host results remain unchanged and return required evidence."
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
  durableContextNoticeSummary: {
    zh: "Dove 的 .dove 状态是项目内文件系统事实源；要让这些工作流产物有资格随 Claude 或其他编程终端回滚，应使用 mutationMode: patch-plan 并由 host 的受追踪文件编辑机制应用；CLI/MCP direct-process 写入不被声明为已验证可回滚。",
    en: "Dove .dove state is an in-project filesystem source of truth; to make those workflow artifacts eligible for Claude or other programming-terminal rollback, use mutationMode: patch-plan and apply it through host-tracked file edits. CLI/MCP direct-process writes are not declared verified rollback-safe."
  },
  durableContextNoticeRecovery: {
    zh: "如果 host 回滚后 .dove 没有一起回滚，不要使用 reset_dove_version 当恢复入口；改用 patch-plan 让 host tracked edits 应用后再依赖 host 回滚。direct-process 仍可用于功能优先写入，但回滚覆盖保持 unverified。",
    en: "If .dove did not roll back with the host rollback, do not use reset_dove_version as a restore path; use patch-plan so host tracked edits apply the files before relying on host rollback. direct-process remains available for functional writes, but rollback coverage stays unverified."
  },
  statusHomeInitTitle: {
    zh: "先创建 Dove 项目目标",
    en: "Create the Dove project goal first"
  },
  statusHomeInitWhy: {
    zh: "当前工作区还没有 level-0 init 目标，后续任务需要先挂到这个根目标下。",
    en: "The workspace has no level-0 init goal yet, and later work needs that root."
  },
  statusHomeCreateMissionTitle: {
    zh: "创建下一个具体 mission",
    en: "Create the next concrete mission"
  },
  statusHomeCreateMissionWhy: {
    zh: "当前没有需要继续推进的活跃任务，下一步应从一个真实需求开始。",
    en: "There is no active task to continue, so the next step should start from a real demand."
  },
  statusHomeBoundaryTitle: {
    zh: ({ title }) => `处理 ${title} 的等待边界`,
    en: ({ title }) => `Resolve waiting boundary for ${title}`
  },
  statusHomeBoundaryWhy: {
    zh: ({ reason }) => reason || "任务停在一个需要补输入、证据或人工动作的边界。",
    en: ({ reason }) => reason || "The task is stopped at a boundary that needs input, evidence, or operator action."
  },
  statusHomeContinuationTitle: {
    zh: ({ title }) => `继续 ${title}`,
    en: ({ title }) => `Continue ${title}`
  },
  statusHomeContinuationWhy: {
    zh: "runtime 里有明确的前台续跑线索，可以从这里恢复。",
    en: "Runtime state has an explicit foreground continuation hint for this task."
  },
  statusHomeBlockedTitle: {
    zh: ({ title }) => `解除 ${title} 的阻塞`,
    en: ({ title }) => `Unblock ${title}`
  },
  statusHomeBlockedWhy: {
    zh: ({ reason }) => reason || "任务当前带有阻塞信号，需要先解释或解除阻塞。",
    en: ({ reason }) => reason || "The task currently has a blocker signal that needs explanation or removal."
  },
  statusHomeReviewTitle: {
    zh: "处理待审查问题",
    en: "Handle pending review issues"
  },
  statusHomeReviewWhy: {
    zh: "当前 review state 里还有未解决关注点。",
    en: "The current review state still has unresolved concerns."
  },
  statusHomeContinueTitle: {
    zh: ({ title }) => `推进 ${title}`,
    en: ({ title }) => `Advance ${title}`
  },
  statusHomeContinueWhy: {
    zh: "任务已有下一步命令，可以继续一次前台推进。",
    en: "The task already has a next command and can continue with one foreground step."
  },
  statusHomeReconcileTitle: {
    zh: ({ count }) => `核对 ${count} 个 done 父 mission 的 checklist 一致性`,
    en: ({ count }) => `Reconcile checklist consistency for ${count} done parent mission${count === 1 ? "" : "s"}`
  },
  statusHomeReconcileWhy: {
    zh: "已有父 mission 是 done，但下面还有 open checklist 子项；先核对这些子项是否被父任务证据覆盖，覆盖才逐项标 done，否则应重开父任务。",
    en: "A parent mission is done while checklist children remain open; verify whether the parent evidence covers each child, mark covered children done, or reopen the parent."
  },
  statusHomeReconcileDoneCriteria: {
    zh: "每个 open checklist 子项都有对应证据，或父 mission 被退回 open 状态继续处理。",
    en: "Each open checklist child has matching evidence, or the parent mission is moved back to an open state for continued work."
  },
  boundaryActionContinueLabel: {
    zh: "继续/恢复前台执行",
    en: "Continue or resume foreground work"
  },
  boundaryActionEvidenceLabel: {
    zh: "补真实结果或证据",
    en: "Provide real result or evidence"
  },
  boundaryActionReviewLabel: {
    zh: "送独立 review",
    en: "Send to independent review"
  },
  boundaryActionStatusLabel: {
    zh: "调整任务状态",
    en: "Adjust task status"
  },
  boundaryActionKillLabel: {
    zh: "通过 status 标记 killed",
    en: "Mark killed through status"
  },
  compactCardScope: {
    zh: ({ stage, domain, status }) => `${stage}/${domain} · ${status}`,
    en: ({ stage, domain, status }) => `${stage}/${domain} · ${status}`
  },
  compactCardNoEvidence: {
    zh: "尚未列出证据要求。",
    en: "No evidence requirement is listed yet."
  },
  compactCardNoAutomaticExecution: {
    zh: "不会自动执行；需要显式确认。",
    en: "No automatic execution; explicit confirmation is required."
  },
  compactCardFirstActionFallback: {
    zh: "确认后执行下一步前台动作。",
    en: "After confirmation, run the next foreground action."
  },
  compactCardBoundaryFallback: {
    zh: "如果缺少真实证据，Dove 会记录边界而不是声称完成。",
    en: "If real evidence is missing, Dove records a boundary instead of claiming completion."
  },
  resultCardHappenedFallback: {
    zh: "已记录本次 Dove 命令结果。",
    en: "Recorded this Dove command result."
  },
  resultCardNoEvidence: {
    zh: "本次结果没有记录显式证据。",
    en: "No explicit evidence was recorded for this result."
  },
  resultCardNoValidation: {
    zh: "本次结果没有记录显式验证输出。",
    en: "No explicit validation output was recorded for this result."
  },
  resultCardCodeNotInspected: {
    zh: "本次工具没有检查代码改动；不要从本卡片推断代码文件。",
    en: "This tool did not inspect code changes; do not infer changed code files from this card."
  },
  resultCardNoDurableWrites: {
    zh: "本次结果没有声明新的持久写入。",
    en: "This result did not declare new durable writes."
  },
  resultCardRuntimeResultRecorded: {
    zh: "已记录 runtime result。",
    en: "Runtime result recorded."
  },
  resultCardTaskPacketUpdated: {
    zh: "已更新任务 packet。",
    en: "Task packet updated."
  },
  resultCardTaskIndexUpdated: {
    zh: "已更新 task packet index。",
    en: "Task packet index updated."
  },
  resultCardRuntimeEventRecorded: {
    zh: "已记录 runtime/lifecycle event。",
    en: "Runtime/lifecycle event recorded."
  },
  resultCardReviewInputPrepared: {
    zh: "已准备隔离 review 输入包。",
    en: "Isolated review input bundle prepared."
  },
  resultCardReviewImported: {
    zh: "已导入隔离 review handoff。",
    en: "Isolated review handoff imported."
  },
  resultCardNextStatus: {
    zh: "查看 Dove status。",
    en: "Open Dove status."
  },
  resultCardNextProvideEvidence: {
    zh: "补真实结果或证据。",
    en: "Provide real result or evidence."
  },
  resultCardNextImportReview: {
    zh: "导入 review handoff。",
    en: "Import review handoff."
  },
  resultCardNextAdjustStatus: {
    zh: "通过 status 调整任务状态。",
    en: "Adjust task status through status."
  },
  evidenceResolutionNoArtifacts: {
    zh: "本次没有提供用于选择任务的 artifact/evidence 路径。",
    en: "No artifact/evidence path was provided for task selection."
  },
  evidenceResolutionNoSelectedPacket: {
    zh: "本次没有选中可接收证据的持久任务。",
    en: "No durable task was selected to receive evidence."
  },
  evidenceResolutionAcceptedSelf: {
    zh: "证据已经属于当前任务，可以直接记录到该任务。",
    en: "The evidence already belongs to the selected task and can be recorded there."
  },
  evidenceResolutionAcceptedDescendant: {
    zh: "证据属于当前任务的子任务，可以归入这个父任务结果。",
    en: "The evidence belongs to a descendant task and can be rolled up into this parent result."
  },
  evidenceResolutionNoExistingOwner: {
    zh: "提供的证据尚未被其他任务声明；本次会归入当前选中的任务。",
    en: "The provided evidence is not claimed by another task; this pass can attach it to the selected task."
  },
  evidenceResolutionConflict: {
    zh: "提供的证据已被其他任务声明；需要选择正确 packet，或改用当前任务/子任务的证据。",
    en: "The provided evidence is already claimed by another task; choose the correct packet or use evidence from the selected task/descendants."
  },
  resultCardHandoffResolveBoundary: {
    zh: ({ ownerRole }) => `由 ${ownerRole || "当前角色"} 处理当前边界，补齐输入或证据后再回到 status。`,
    en: ({ ownerRole }) => `${ownerRole || "the current role"} should resolve the current boundary, provide required input/evidence, then return to status.`
  },
  resultCardHandoffRoleTransfer: {
    zh: ({ ownerRole, nextRole }) => `从 ${ownerRole || "当前角色"} 交接给 ${nextRole || "下一角色"} 处理当前边界。`,
    en: ({ ownerRole, nextRole }) => `Hand off from ${ownerRole || "the current role"} to ${nextRole || "the next role"} to resolve the current boundary.`
  },
  resultCardHandoffProvideEvidence: {
    zh: "需要操作者或主机侧补真实执行结果/证据；Dove 不会假装已经完成。",
    en: "The operator or host must provide real execution results/evidence; Dove will not pretend the work is complete."
  },
  resultCardHandoffImportReview: {
    zh: "等待 reviewer 产出 handoff/report 后导入；不要导入 reviewer 私有 transcript。",
    en: "Wait for the reviewer handoff/report, then import it; do not import reviewer private transcript."
  },
  resultCardHandoffAddressReview: {
    zh: "review 已返回需要处理的问题；下一步应创建或推进修复任务。",
    en: "Review returned issues to address; next create or advance a fix task."
  },
  resultCardNextCreateFixMission: {
    zh: "创建或推进修复 mission。",
    en: "Create or advance a fix mission."
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
