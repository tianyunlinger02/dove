import fs from "node:fs";
import path from "node:path";

import { assessMissionCompletion } from "./completion-gates.mjs";
import { queryDomainIntegrity } from "./retained-domain-workflows.mjs";
import { readExecutionReceipts } from "./execution-receipts.mjs";
import { assertCurrentMissionContract, previewDoveMissionContract } from "./mission-contracts.mjs";
import { verifyReviewCoverage } from "./review-exchange.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import { querySources } from "./source-trust.mjs";
import { openDoveWorkspace } from "./workspace-schema.mjs";

function wantsFullStatus(args = {}) {
  return args.full === true || args.includeDetails === true || args.includeMissionDetails === true || args.showMissions === true || args.detail === "full" || args.view === "full";
}

function responseLanguage(args = {}) {
  return args.responseLanguage === "en" || args.language === "en" ? "en" : "zh";
}

function compactDomainIntegrity(integrity) {
  return {
    artifactCount: integrity.artifactCount,
    staleArtifactCount: integrity.staleArtifactCount,
    stalePaths: integrity.stalePaths
  };
}

function readCurrentMissions(root, options = {}) {
  const workspace = openDoveWorkspace(root, { allowAbsent: options.allowAbsent === true, operation: options.operation ?? "Dove mission query" });
  if (workspace.state === "absent") return { workspace, missions: [] };
  const missionsRoot = path.resolve(root, ARTIFACT_PATHS.missionsDir);
  const missions = fs.readdirSync(missionsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => {
      const relativePath = path.posix.join(ARTIFACT_PATHS.missionsDir, entry.name);
      let mission;
      try {
        mission = JSON.parse(fs.readFileSync(path.resolve(root, relativePath), "utf8"));
      } catch (error) {
        throw new Error(`Malformed durable JSON in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
      assertCurrentMissionContract(mission);
      return mission;
    })
    .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)) || left.missionId.localeCompare(right.missionId));
  return { workspace, missions };
}

function emptyStatus(args, language) {
  const headline = language === "en" ? "Dove is not initialized in this workspace." : "当前 workspace 尚未初始化 Dove。";
  const result = {
    mode: "dove-status-query",
    query: true,
    proposalOnly: true,
    noAutoApply: true,
    intent: typeof args.intent === "string" ? args.intent.trim() || null : null,
    responseLanguage: language,
    detail: "compact",
    detailsAvailable: true,
    summary: headline,
    headline,
    scope: { kind: "minimal-mission-workspace", schemaVersion: null, state: "absent" },
    currentContext: { missionCount: 0, receiptCount: 0, sourceCount: 0, integrityAssessment: null, domainIntegrity: null, reviewValidity: null },
    nextStep: { label: language === "en" ? "Run dove init, inspect the proposal, and confirm the exact replay data." : "运行 dove init，检查 proposal，并确认 exact replay data。" },
    needsAttention: { status: "needs-init", summary: language === "en" ? "A confirmed initialization is required before durable Dove work can begin." : "开始 durable Dove 工作前需要先确认初始化。" },
    changes: { intent: "none", applied: false, count: 0, rollback: "not-applicable" },
    showMore: { detailsAvailable: true },
    optionalMissionDetails: null,
    statusHome: null
  };
  result.statusHome = {
    presentation: "dove-project-situation-home",
    detail: result.detail,
    liveContextFirst: true,
    intent: result.intent,
    headline,
    scope: result.scope,
    currentContext: result.currentContext,
    nextStep: result.nextStep,
    needsAttention: result.needsAttention,
    changes: result.changes,
    showMore: result.showMore,
    optionalMissionDetails: null,
    detailsAvailable: true
  };
  return wantsFullStatus(args) ? { ...result, detail: "full", manifest: null, project: null, missions: [], integrityAssessment: null, domainIntegrity: null, sourceIntegrity: null, reviewValidity: null, diagnostics: { artifactPathsRead: [], noRefresh: true, noCommandExecution: true, noExternalProcess: true, noGitInspection: true, noSourceMutation: true } } : result;
}

export function queryDoveStatus(root, args = {}) {
  const language = responseLanguage(args);
  const { workspace, missions } = readCurrentMissions(root, { allowAbsent: true, operation: "Dove status" });
  if (workspace.state === "absent") return emptyStatus(args, language);

  const latestMission = missions.at(-1) ?? null;
  const integrityAssessment = latestMission ? assessMissionCompletion(root, { missionId: latestMission.missionId }) : null;
  const receipts = readExecutionReceipts(root);
  const malformedReceipt = receipts.find((receipt) => receipt.__readFailure);
  if (malformedReceipt) throw new Error(`Malformed durable JSON in ${path.posix.join(ARTIFACT_PATHS.executionReceiptsDir, `${malformedReceipt.receiptId}.json`)}: ${malformedReceipt.__readFailure}`);
  const domainIntegrity = queryDomainIntegrity(root);
  const sourceItems = missions.flatMap((mission) => querySources(root, { missionId: mission.missionId, limit: 200 }).items);
  const sourceIntegrity = {
    sourceCount: sourceItems.length,
    eligibleCount: sourceItems.filter((item) => item.eligibility?.eligible === true).length,
    candidateCount: sourceItems.filter((item) => item.lifecycle === "candidate").length,
    rejectedCount: sourceItems.filter((item) => item.lifecycle === "rejected").length,
    invalidCount: sourceItems.filter((item) => item.eligibility?.eligible !== true && item.lifecycle === "verified").length
  };
  const reviewValidity = latestMission ? verifyReviewCoverage(root, { missionId: latestMission.missionId }) : { covered: false, authoritative: false, failures: ["mission-missing"] };
  const headline = language === "en"
    ? `Dove schema ${workspace.schemaVersion} is healthy with ${missions.length} mission contract${missions.length === 1 ? "" : "s"}.`
    : `Dove schema ${workspace.schemaVersion} 健康，当前有 ${missions.length} 个 mission contract。`;
  const attentionReasons = [
    ...(integrityAssessment && !integrityAssessment.complete ? integrityAssessment.incompleteReasons : []),
    ...(domainIntegrity.stalePaths ?? []),
    ...(sourceIntegrity.invalidCount > 0 ? ["invalid-source-verification"] : [])
  ];
  const currentContext = {
    missionCount: missions.length,
    receiptCount: receipts.length,
    sourceCount: sourceIntegrity.sourceCount,
    integrityAssessment: integrityAssessment ? { complete: integrityAssessment.complete, staleReceiptCount: integrityAssessment.staleReceiptIds.length, incompleteReasons: integrityAssessment.incompleteReasons } : null,
    domainIntegrity: compactDomainIntegrity(domainIntegrity),
    reviewValidity: { covered: reviewValidity.covered === true, authoritative: reviewValidity.authoritative === true, failures: reviewValidity.failures ?? [] }
  };
  const result = {
    mode: "dove-status-query",
    query: true,
    proposalOnly: true,
    noAutoApply: true,
    intent: typeof args.intent === "string" ? args.intent.trim() || null : null,
    responseLanguage: language,
    detail: "compact",
    detailsAvailable: true,
    summary: headline,
    headline,
    scope: { kind: "minimal-mission-workspace", schemaVersion: workspace.schemaVersion },
    currentContext,
    nextStep: { label: latestMission ? (language === "en" ? "Continue the approved work with native host planning." : "由宿主原生 plan 继续已批准工作。") : (language === "en" ? "Create one minimal mission contract." : "创建一个最小 mission contract。") },
    needsAttention: attentionReasons.length ? { status: "incomplete", summary: language === "en" ? "Current mission or domain evidence is incomplete." : "当前 mission 或领域证据尚不完整。", reasons: attentionReasons } : { status: "clear", summary: language === "en" ? "No current mission or domain integrity failure is present." : "当前没有 mission 或领域完整性失败。" },
    changes: { intent: "none", applied: false, count: 0, rollback: "not-applicable" },
    showMore: { detailsAvailable: true },
    optionalMissionDetails: null,
    statusHome: null
  };
  result.statusHome = { presentation: "dove-project-situation-home", detail: result.detail, liveContextFirst: true, intent: result.intent, headline, scope: result.scope, currentContext, nextStep: result.nextStep, needsAttention: result.needsAttention, changes: result.changes, showMore: result.showMore, optionalMissionDetails: null, detailsAvailable: true };
  if (!wantsFullStatus(args)) return result;
  return {
    ...result,
    detail: "full",
    manifest: workspace.manifest,
    project: workspace.project,
    missions,
    integrityAssessment,
    domainIntegrity,
    sourceIntegrity,
    reviewValidity,
    diagnostics: {
      artifactPathsRead: [ARTIFACT_PATHS.doveRootManifest, ARTIFACT_PATHS.projectIdentity, ARTIFACT_PATHS.missionsDir, ARTIFACT_PATHS.executionReceiptsDir, ARTIFACT_PATHS.artifactOwnership, ARTIFACT_PATHS.artifactLineage, ".dove/sources"],
      noRefresh: true,
      noCommandExecution: true,
      noExternalProcess: true,
      noGitInspection: true,
      noSourceMutation: true
    }
  };
}

export function queryDoveMission(root, args = {}) {
  const inspection = openDoveWorkspace(root, { allowAbsent: true, operation: "Dove mission preview" });
  if (inspection.state !== "absent") openDoveWorkspace(root, { operation: "Dove mission preview" });
  return previewDoveMissionContract(root, args);
}
