import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { artifactHandoffPath, createArtifactHandoff } from "./artifact-handoffs.mjs";
import { artifactEvidenceRole, normalizeProjectRelativePath } from "./artifact-integrity.mjs";
import { resolveCanonicalContainedWrite } from "./contained-write.mjs";
import {
  MISSION_BRANCH_KINDS, MISSION_CONTRACT_INPUT_FIELDS, MISSION_CONTRACT_SCHEMA_VERSION, MISSION_MODES,
  MISSION_CRITERION_ID_VERSION, MISSION_EVIDENCE_REQUIREMENT_ID_VERSION, assertCurrentMissionContract as assertCanonicalMissionContract,
  currentMissionContractMetadata as canonicalMissionContractMetadata, missionCompletionCriteria, missionCompletionCriterionId,
  missionContractDigest, missionEvidenceRequirementId, missionEvidenceRequirements, normalizeMissionContractContent, stableMissionSerialize
} from "./mission-contract-integrity.mjs";
import { validateMissionGraph } from "./mission-graph.mjs";
import { createMissionTransition, missionTransitionPath } from "./mission-lifecycle.mjs";
import { createInitialMissionResearchDecision } from "./mission-research-decision.mjs";
import { currentMutationContext, isPatchPlanMode, normalizeMutationMode, runWithMutationContext } from "./mutation-backend.mjs";
import { researchDecisionPath } from "./research-decision-store.mjs";
import { reviewMissionBinding } from "./review-mission-binding.mjs";
import { createResearchHandoff } from "./research-handoff.mjs";
import { ARTIFACT_PATHS, DOVE_RESEARCH_SKILL_IDS, DOVE_WORKSPACE_SCHEMA_VERSION } from "./schema.mjs";
import { assertGovernanceMutationRegistered, nowIso, writeJson } from "./workspace.mjs";
import { initDoveWorkspace } from "./workspace-init.mjs";
import { openDoveWorkspace } from "./workspace-schema.mjs";

export { MISSION_BRANCH_KINDS, MISSION_CONTRACT_SCHEMA_VERSION, MISSION_MODES, MISSION_CRITERION_ID_VERSION, MISSION_EVIDENCE_REQUIREMENT_ID_VERSION } from "./mission-contract-integrity.mjs";
export const MISSION_PROPOSAL_VERSION = 4;
export const PROJECT_IDENTITY_SCHEMA_VERSION = 2;

const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const CREATE_EXTRA_FIELDS = new Set(["operation", "stopParentReason", "handoffArtifactPaths"]);
const REPLAY_FIELDS = new Set(["confirmed", "proposalVersion", "proposalWorkspace", "proposalDigest", "mutationMode", "workspaceId", "workspaceRevisionId", "workspaceRevisionDigest", "createdAt", "decisionCreatedAt", "handoffIssuedAt", "handoffExpiresAt", "parentTransitionId", "artifactHandoffIds"]);
const AMBIENT_FIELDS = new Set(["goal", "requirements", "assumptions", "scope", "outOfScope", "artifacts", "completionCriteria", "mode", "evidenceRequirements", "mainlineAlignment", "changesWorkspaceMainline"]);
const SKILL_START_FIELDS = new Set(["operation", "skill", "goal", "requirements", "assumptions", "scope", "outOfScope", "artifacts", "completionCriteria", "evidenceRequirements", "parentMissionId", "contextArtifactPaths"]);
const WORKSPACE_FIELDS = new Set(["operation", "projectBrief", "mainline", "changeReason", "archiveReset", "confirmed", "proposalVersion", "proposalWorkspace", "proposalDigest", "mutationMode", "workspaceId", "createdAt", "detectedState", "detectedSchema", "sourceIdentity", "sourceTreeDigest", "archiveTarget", "currentRevisionId", "currentRevisionDigest", "activeMissionIds"]);
const SKILL_ID_SET = new Set(DOVE_RESEARCH_SKILL_IDS);

function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function text(value, fallback = null) { if (typeof value !== "string") return fallback; const result = value.trim(); return result || fallback; }
function plain(value, label) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`); }
function allowed(value, fields, label) { plain(value, `${label} arguments`); const unknown = Object.keys(value).filter((field) => !fields.has(field)); if (unknown.length) throw new Error(`${label} does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`); }
function canonicalWorkspace(root) { return fs.realpathSync.native(path.resolve(root)); }
function slugify(value) { return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "mission"; }
function missionId(value, goal) { const id = text(value, `mission-${slugify(goal)}-${sha256(goal).slice(0, 10)}`); if (!SAFE_ID.test(id)) throw new Error("missionId must be a safe lowercase identifier."); return id; }
function missionPath(id) { return path.posix.join(ARTIFACT_PATHS.missionsDir, `${id}.json`); }
function addMilliseconds(timestamp, milliseconds) { return new Date(Date.parse(timestamp) + milliseconds).toISOString(); }
function nextCreatedAt(workspace) { const now = nowIso(); const latest = [...workspace.missions.values()].reduce((value, mission) => mission.createdAt > value ? mission.createdAt : value, ""); return latest && now <= latest ? addMilliseconds(latest, 1) : now; }
function replayTimestamp(args, field, fallback, confirmed, label) { const supplied = text(args[field], null); if (confirmed && !supplied) throw new Error(`Confirmed mission replay requires ${label}.`); const result = supplied ?? fallback; if (!Number.isFinite(Date.parse(result)) || new Date(Date.parse(result)).toISOString() !== result) throw new Error(`${label} must be an exact ISO timestamp.`); return result; }
function mutationMode(root, args) { const explicit = Object.hasOwn(args, "mutationMode") ? normalizeMutationMode(args.mutationMode) : null; const active = currentMutationContext(root)?.mutationMode ?? null; if (active && explicit && active !== explicit) throw new Error("Mission mutationMode does not match the active MutationContext."); return active ?? explicit ?? "direct-process"; }
function exists(root, relativePath) { return currentMutationContext(root)?.fileExists(relativePath) ?? fs.existsSync(path.join(root, relativePath)); }

function artifactIdentity(root, rawPath) {
  const normalized = normalizeProjectRelativePath(rawPath); if (!normalized.ok) throw new Error(`Invalid mission artifact path: ${rawPath}.`); const relativePath = normalized.normalizedPath;
  const fullPath = path.join(root, relativePath); if (!fs.existsSync(fullPath)) { resolveCanonicalContainedWrite(root, relativePath, { label: "Mission artifact path" }); return { path: relativePath, exists: false }; }
  const stat = fs.lstatSync(fullPath); if (stat.isSymbolicLink()) throw new Error(`Mission artifacts must not be symbolic links: ${relativePath}.`); resolveCanonicalContainedWrite(root, relativePath, { label: "Mission artifact path" });
  return stat.isFile() ? { path: relativePath, exists: true, kind: "file", sizeBytes: stat.size, sha256: sha256(fs.readFileSync(fullPath)) } : { path: relativePath, exists: true, kind: stat.isDirectory() ? "directory" : "other" };
}
function normalizeHandoffPaths(value) { if (value === undefined) return []; if (!Array.isArray(value)) throw new Error("handoffArtifactPaths must be an array."); const result = value.map((item, index) => { const normalized = normalizeProjectRelativePath(item); if (!normalized.ok || normalized.normalizedPath !== item || artifactEvidenceRole(item) !== "external-project") throw new Error(`handoffArtifactPaths[${index}] must be a canonical external project path.`); return item; }); if (new Set(result).size !== result.length) throw new Error("handoffArtifactPaths must not contain duplicates."); return result; }
function branchRecords(workspace, content, args, createdAt) {
  if (!content.parentMissionId) { if (args.stopParentReason !== undefined || args.handoffArtifactPaths !== undefined) throw new Error("Root mission creation must not declare parent handoff fields."); return { transition: null, artifactHandoffs: [] }; }
  const parent = workspace.missions.get(content.parentMissionId); if (!parent) throw new Error(`Parent mission does not exist: ${content.parentMissionId}.`);
  const ordinaryChild = args.operation === "create-child";
  if (ordinaryChild) {
    if (args.stopParentReason !== undefined || args.handoffArtifactPaths !== undefined) throw new Error("Ordinary child mission creation must not stop its parent or transfer artifact ownership.");
    return { transition: null, artifactHandoffs: [] };
  }
  const existingTransition = workspace.missionTransitions.get(parent.missionId) ?? null; const reason = text(args.stopParentReason, null); if (!existingTransition && !reason) throw new Error("Branching from an active parent requires stopParentReason."); if (existingTransition && reason) throw new Error("A terminal parent must not be stopped again.");
  const transition = existingTransition ? null : createMissionTransition({ workspaceId: workspace.manifest.workspaceId, missionId: parent.missionId, contractDigest: parent.contractDigest, workspaceRevisionId: parent.workspaceRevisionId, status: "stopped", reason, evidenceRefs: [], trigger: "user", createdAt });
  const artifactHandoffs = normalizeHandoffPaths(args.handoffArtifactPaths).map((artifactPath) => { const owner = workspace.receiptLedger.currentOwnership.find((item) => item.path === artifactPath); if (!owner || owner.missionId !== parent.missionId) throw new Error(`Artifact ${artifactPath} is not owned by the parent mission.`); return createArtifactHandoff({ workspaceId: workspace.manifest.workspaceId, path: artifactPath, fromMissionId: parent.missionId, toMissionId: content.missionId, fromReceiptId: owner.receiptId, fromSha256: owner.sha256, reason: content.branchReason, createdAt }); });
  return { transition, artifactHandoffs };
}

function buildProposal(root, args) {
  const workspacePath = canonicalWorkspace(root); const opened = openDoveWorkspace(root, { operation: "Dove mission creation" }); const revision = opened.currentWorkspaceRevision;
  const content = normalizeMissionContractContent(Object.fromEntries(Object.entries(args).filter(([field]) => !CREATE_EXTRA_FIELDS.has(field) && !REPLAY_FIELDS.has(field))));
  const id = missionId(args.missionId, content.goal); if (content.parentMissionId === id) throw new Error("Mission must not be its own parent."); content.missionId = id;
  if (args.confirmed && (args.workspaceId !== opened.manifest.workspaceId || args.workspaceRevisionId !== revision.revisionId || args.workspaceRevisionDigest !== revision.revisionDigest)) throw new Error("Mission replay no longer matches the current workspace revision.");
  const createdAt = replayTimestamp(args, "createdAt", nextCreatedAt(opened), args.confirmed === true, "mission createdAt");
  const persisted = { schemaVersion: MISSION_CONTRACT_SCHEMA_VERSION, workspaceId: opened.manifest.workspaceId, workspaceRevisionId: revision.revisionId, workspaceRevisionDigest: revision.revisionDigest, missionId: id, contractDigest: missionContractDigest(id, content, { workspaceRevisionId: revision.revisionId, workspaceRevisionDigest: revision.revisionDigest }), createdAt, ...content };
  delete persisted.missionId; persisted.missionId = id;
  validateMissionGraph([...opened.missions.values(), persisted].map((mission) => ({ filename: `${mission.missionId}.json`, mission })));
  const branch = branchRecords(opened, persisted, args, createdAt);
  let researchDecision = null; let researchHandoff = null;
  if (content.mode === "research") {
    const decisionCreatedAt = replayTimestamp(args, "decisionCreatedAt", createdAt, args.confirmed === true, "research decision createdAt"); const handoffIssuedAt = replayTimestamp(args, "handoffIssuedAt", decisionCreatedAt, args.confirmed === true, "research handoff issuedAt"); const handoffExpiresAt = replayTimestamp(args, "handoffExpiresAt", addMilliseconds(handoffIssuedAt, FOUR_HOURS_MS), args.confirmed === true, "research handoff expiresAt");
    if (decisionCreatedAt !== createdAt || handoffIssuedAt !== decisionCreatedAt || handoffExpiresAt !== addMilliseconds(handoffIssuedAt, FOUR_HOURS_MS)) throw new Error("Mission, initial decision, and handoff timestamps must use the canonical window.");
    researchDecision = createInitialMissionResearchDecision({ mission: persisted, createdAt: decisionCreatedAt }); researchHandoff = createResearchHandoff(researchDecision, { issuedAt: handoffIssuedAt, expiresAt: handoffExpiresAt });
  }
  const targetIdentities = content.artifacts.map((item) => artifactIdentity(root, item.path)); const mode = mutationMode(root, args);
  const creationOperation = args.operation ?? (content.parentMissionId ? "branch" : "create-root");
  const envelope = { proposalVersion: MISSION_PROPOSAL_VERSION, workspace: workspacePath, mutationMode: mode, workspaceSchemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION, workspaceId: opened.manifest.workspaceId, workspaceRevisionId: revision.revisionId, workspaceRevisionDigest: revision.revisionDigest, creationOperation, targetArtifactIdentities: targetIdentities, mission: persisted, ...(researchDecision ? { researchDecision, researchHandoff } : {}), parentTransitionId: branch.transition?.transitionId ?? null, artifactHandoffIds: branch.artifactHandoffs.map((item) => item.handoffId) };
  return { workspace: workspacePath, opened, revision, mutationMode: mode, creationOperation, content, mission: persisted, researchDecision, researchHandoff, targetIdentities, branch, proposalDigest: sha256(stableMissionSerialize(envelope)) };
}
function confirmation(proposal) { return { confirmed: true, proposalVersion: MISSION_PROPOSAL_VERSION, proposalWorkspace: proposal.workspace, proposalDigest: proposal.proposalDigest, mutationMode: proposal.mutationMode, workspaceId: proposal.opened.manifest.workspaceId, workspaceRevisionId: proposal.revision.revisionId, workspaceRevisionDigest: proposal.revision.revisionDigest, createdAt: proposal.mission.createdAt, ...(proposal.researchDecision ? { decisionCreatedAt: proposal.researchDecision.createdAt, handoffIssuedAt: proposal.researchHandoff.issuedAt, handoffExpiresAt: proposal.researchHandoff.expiresAt } : {}), parentTransitionId: proposal.branch.transition?.transitionId ?? null, artifactHandoffIds: proposal.branch.artifactHandoffs.map((item) => item.handoffId), operation: proposal.creationOperation, missionId: proposal.mission.missionId, ...proposal.content, ...(proposal.branch.transition ? { stopParentReason: proposal.branch.transition.reason } : {}), ...(proposal.branch.artifactHandoffs.length ? { handoffArtifactPaths: proposal.branch.artifactHandoffs.map((item) => item.path) } : {}) }; }
function paths(proposal) { return [...(proposal.branch.transition ? [missionTransitionPath(proposal.branch.transition.transitionId)] : []), ...proposal.branch.artifactHandoffs.map((item) => artifactHandoffPath(item.handoffId)), missionPath(proposal.mission.missionId), ...(proposal.researchDecision ? [researchDecisionPath(proposal.researchDecision.decisionId)] : [])]; }

export { missionCompletionCriteria, missionCompletionCriterionId, missionEvidenceRequirementId, missionEvidenceRequirements };
export const currentMissionContractMetadata = canonicalMissionContractMetadata;
export const assertCurrentMissionContract = assertCanonicalMissionContract;
export function newMissionId() { return `mission-${crypto.randomUUID()}`; }
function normalizeSkillId(value) { const skill = text(value, null); if (!SKILL_ID_SET.has(skill)) throw new Error(`Skill must be one of: ${DOVE_RESEARCH_SKILL_IDS.join(", ")}.`); return skill; }
function normalizeContextArtifactPaths(value) { if (value === undefined) return []; if (!Array.isArray(value)) throw new Error("contextArtifactPaths must be an array."); const paths = value.map((item, index) => { const normalized = normalizeProjectRelativePath(item); if (!normalized.ok || normalized.normalizedPath !== item || artifactEvidenceRole(item) !== "external-project") throw new Error(`contextArtifactPaths[${index}] must be a canonical external project path.`); return item; }); if (new Set(paths).size !== paths.length) throw new Error("contextArtifactPaths must not contain duplicates."); return paths; }
function skillParentMission(workspace, args) {
  const explicitParentId = text(args.parentMissionId, null);
  const contextPaths = normalizeContextArtifactPaths(args.contextArtifactPaths);
  const owners = contextPaths.map((artifactPath) => workspace.receiptLedger.currentOwnership.find((item) => item.path === artifactPath) ?? null);
  if (owners.some((owner) => owner === null)) throw new Error("Each context artifact must have one current mission owner before it can select a parent.");
  const ownerIds = [...new Set(owners.map((owner) => owner.missionId))];
  if (ownerIds.length > 1) throw new Error("The supplied context artifacts do not identify one unambiguous parent mission.");
  if (explicitParentId) {
    const parent = workspace.missions.get(explicitParentId);
    if (!parent) throw new Error("The selected parent mission is no longer available.");
    if (ownerIds.length === 1 && ownerIds[0] !== explicitParentId) throw new Error("The explicit parent hint conflicts with current context artifact ownership.");
    return parent;
  }
  if (ownerIds.length === 0) return null;
  const parent = workspace.missions.get(ownerIds[0]);
  if (!parent) throw new Error("The supplied context artifacts refer to an unavailable parent mission.");
  return parent;
}
export function startDoveSkillMission(root, args = {}) {
  assertGovernanceMutationRegistered("create-dove-mission", "guarded"); allowed(args, SKILL_START_FIELDS, "Dove skill start");
  if (args.operation !== "start-skill") throw new Error("Dove skill start requires operation=start-skill.");
  if (!currentMutationContext(root)) throw new Error("Dove skill start requires an active MutationContext.");
  const skill = normalizeSkillId(args.skill); const goal = text(args.goal, null); if (!goal) throw new Error("Dove skill start requires a bounded goal.");
  const workspace = openDoveWorkspace(root, { operation: "Dove skill mission routing" }); const parent = skillParentMission(workspace, args);
  const contextPaths = normalizeContextArtifactPaths(args.contextArtifactPaths);
  const contractArgs = Object.fromEntries(Object.entries(args).filter(([field]) => !["operation", "skill", "parentMissionId", "contextArtifactPaths"].includes(field)));
  const proposal = createDoveMission(root, {
    ...contractArgs,
    operation: parent ? "create-child" : "create-root",
    missionId: newMissionId(),
    mode: "research",
    goal,
    ...(parent ? { parentMissionId: parent.missionId, branchKind: "follow-up", branchReason: `Run the ${skill} research skill in service of the selected parent mission.` } : {}),
    mutationMode: "direct-process"
  });
  const applied = createDoveMission(root, proposal.confirmation.confirmArgs);
  return {
    ...applied,
    operation: "start-skill",
    skill,
    ...(skill === "review" ? { reviewMissionBinding: reviewMissionBinding(workspace, applied.mission) } : {}),
    routing: { kind: parent ? "child" : "root", contextArtifactCount: contextPaths.length }
  };
}
export function previewDoveMissionContract(root, args = {}) { allowed(args, new Set(MISSION_CONTRACT_INPUT_FIELDS), "Dove mission preview"); const proposal = buildProposal(root, args); return { status: "proposal", mission: proposal.mission, contractDigest: proposal.mission.contractDigest, confirmation: { required: false }, mutation: { mutationMode: proposal.mutationMode, writesApplied: false, paths: [] } }; }
export function createDoveMission(root, args = {}) {
  assertGovernanceMutationRegistered("create-dove-mission", "guarded"); const operation = args.operation ?? (args.parentMissionId ? "branch" : "create-root"); if (operation === "reevaluate-research-decision") throw new Error("Research decision reevaluation must use its dedicated current operation."); if (!["create", "create-root", "create-child", "branch"].includes(operation)) throw new Error("create_dove_mission operation is unsupported.");
  allowed(args, new Set([...MISSION_CONTRACT_INPUT_FIELDS, ...REPLAY_FIELDS, ...CREATE_EXTRA_FIELDS]), "create_dove_mission"); const proposal = buildProposal(root, args);
  if (!args.confirmed) return { status: "needs-confirmation", mission: proposal.mission, contractDigest: proposal.mission.contractDigest, approval: { required: true, noChangesApplied: true, summary: `Dove can save this immutable mission: ${proposal.mission.goal}`, effects: ["Bind the mission directly to the current workspace revision.", "Save one mission-owned delivery and evidence contract."], question: "Create this mission checkpoint?" }, confirmation: { required: true, exactReplay: true, confirmArgs: confirmation(proposal) }, mutation: { mutationMode: proposal.mutationMode, writesApplied: false, paths: [] } };
  if (!currentMutationContext(proposal.workspace)) throw new Error("Confirmed mission materialization requires an active MutationContext."); if (args.proposalVersion !== MISSION_PROPOSAL_VERSION || args.proposalWorkspace !== proposal.workspace || args.proposalDigest !== proposal.proposalDigest) throw new Error("The selected mission proposal no longer matches current state."); if (exists(root, missionPath(proposal.mission.missionId))) throw new Error(`Mission id already exists: ${proposal.mission.missionId}.`);
  if (proposal.branch.transition) writeJson(root, missionTransitionPath(proposal.branch.transition.transitionId), proposal.branch.transition); for (const item of proposal.branch.artifactHandoffs) writeJson(root, artifactHandoffPath(item.handoffId), item); writeJson(root, missionPath(proposal.mission.missionId), proposal.mission); if (proposal.researchDecision) writeJson(root, researchDecisionPath(proposal.researchDecision.decisionId), proposal.researchDecision);
  const planned = isPatchPlanMode(root); return { status: planned ? "materialization-planned" : "materialized", mission: proposal.mission, contractDigest: proposal.mission.contractDigest, ...(proposal.researchDecision ? { currentResearchDecision: proposal.researchDecision, executionHandoff: proposal.researchHandoff } : {}), mutation: { mutationMode: proposal.mutationMode, writesApplied: !planned, paths: planned ? [] : paths(proposal) } };
}
export function createAmbientDoveMission(root, args = {}) { assertGovernanceMutationRegistered("create-ambient-dove-mission", "guarded"); allowed(args, AMBIENT_FIELDS, "create_ambient_dove_mission"); if (!MISSION_MODES.includes(args.mode)) throw new Error(`Ambient mission creation requires explicit mode: ${MISSION_MODES.join(" or ")}.`); if (args.changesWorkspaceMainline !== false || !text(args.mainlineAlignment, null)) throw new Error("Ambient mission creation requires current-mainline alignment and no mainline change."); const proposal = createDoveMission(root, { ...Object.fromEntries(Object.entries(args).filter(([field]) => !["mainlineAlignment", "changesWorkspaceMainline"].includes(field))), missionId: newMissionId(), operation: "create-root", mutationMode: "direct-process" }); return createDoveMission(root, proposal.confirmation.confirmArgs); }
export function manageDoveWorkspace(root, args = {}) { assertGovernanceMutationRegistered("manage-dove-workspace", "guarded"); allowed(args, WORKSPACE_FIELDS, "Dove workspace"); if (!["set-mainline", "initialize", "revise-mainline"].includes(args.operation)) return initDoveWorkspace(root, args); if (args.operation !== "set-mainline") return initDoveWorkspace(root, args); const projectBrief = text(args.projectBrief, null); const mainline = text(args.mainline, null); if (!projectBrief || !mainline) throw new Error("Workspace mainline replacement requires projectBrief and mainline."); const inspection = openDoveWorkspace(root, { allowAbsent: true, operation: "Dove workspace mainline replacement" }); const serviceArgs = { operation: inspection.state === "absent" ? "initialize" : "revise-mainline", mainline, ...(inspection.state === "absent" ? {} : { changeReason: "Replace the current research mainline through /dove:workspace." }), mutationMode: "direct-process" }; const proposal = initDoveWorkspace(root, serviceArgs); const applied = currentMutationContext(root) ? initDoveWorkspace(root, proposal.confirmation.confirmArgs) : runWithMutationContext(root, { actionId: "manage-dove-workspace", mutationMode: "direct-process", hostId: "service" }, () => initDoveWorkspace(root, proposal.confirmation.confirmArgs)); return { ...applied, operation: "set-mainline", projectBrief }; }
