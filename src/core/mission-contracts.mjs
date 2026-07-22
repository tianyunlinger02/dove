import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  MISSION_CONTRACT_SCHEMA_VERSION,
  MISSION_CRITERION_ID_VERSION,
  MISSION_EVIDENCE_REQUIREMENT_ID_VERSION,
  MISSION_CONTRACT_INPUT_FIELDS,
  assertCurrentMissionContract as assertCanonicalMissionContract,
  currentMissionContractMetadata as canonicalMissionContractMetadata,
  missionCompletionCriteria,
  missionCompletionCriterionId,
  missionContractDigest,
  missionEvidenceRequirementId,
  missionEvidenceRequirements,
  normalizeMissionContractContent,
  stableMissionSerialize
} from "./mission-contract-integrity.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import { artifactEvidenceRole, normalizeProjectRelativePath } from "./artifact-integrity.mjs";
import { validateMissionGraph } from "./mission-graph.mjs";
import { reevaluateResearchTree } from "./research-tree.mjs";
import { resolveCanonicalContainedWrite } from "./contained-write.mjs";
import { currentMutationContext, isPatchPlanMode, normalizeMutationMode } from "./mutation-backend.mjs";
import { assertGovernanceMutationRegistered, nowIso, readJson, writeJson } from "./workspace.mjs";
import { initDoveWorkspace } from "./workspace-init.mjs";
import {
  DOVE_WORKSPACE_SCHEMA_VERSION,
  createMinimalWorkspaceDocuments,
  inspectDoveWorkspace,
  newWorkspaceId,
  openDoveWorkspace,
  workspaceDigest,
  workspaceSchemaError
} from "./workspace-schema.mjs";

export { MISSION_CONTRACT_SCHEMA_VERSION, MISSION_CRITERION_ID_VERSION, MISSION_EVIDENCE_REQUIREMENT_ID_VERSION } from "./mission-contract-integrity.mjs";
export const MISSION_PROPOSAL_VERSION = 1;
export const PROJECT_IDENTITY_SCHEMA_VERSION = 1;

const MISSION_REPLAY_CONTROL_FIELDS = new Set([
  "confirmed",
  "proposalVersion",
  "proposalWorkspace",
  "proposalDigest",
  "mutationMode",
  "workspaceId",
  "createdAt"
]);
const INIT_INPUT_FIELDS = new Set(["goal", "archiveReset", "confirmed", "proposalVersion", "proposalWorkspace", "proposalDigest", "mutationMode", "workspaceId", "createdAt", "detectedState", "detectedSchema", "sourceIdentity", "sourceTreeDigest", "archiveTarget"]);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeString(value, fallback = null) {
  if (typeof value !== "string") {
    return fallback;
  }
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeStringArray(value) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("Mission contract array fields must be arrays of non-empty strings.");
  }
  const normalized = value.map((item) => normalizeString(item, null));
  if (normalized.some((item) => item === null)) {
    throw new Error("Mission contract array fields must contain only non-empty strings.");
  }
  return Array.from(new Set(normalized));
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object.`);
  }
}

function assertAllowedFields(args, allowed, label) {
  assertPlainObject(args, `${label} arguments`);
  const unknown = Object.keys(args).filter((field) => !allowed.has(field));
  if (unknown.length > 0) {
    throw new Error(`${label} does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
  }
}

function canonicalWorkspace(root) {
  return fs.realpathSync.native(path.resolve(root));
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "mission";
}

function normalizeMissionId(value, goal) {
  const fallback = `mission-${slugify(goal)}-${sha256(goal).slice(0, 10)}`;
  const missionId = normalizeString(value, fallback);
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(missionId)) {
    throw new Error("missionId must start with a lowercase letter or digit and contain only lowercase letters, digits, dot, underscore, or hyphen.");
  }
  return missionId;
}

function missionContractContent(args = {}) {
  return normalizeMissionContractContent(args);
}

export { missionCompletionCriteria, missionCompletionCriterionId, missionEvidenceRequirementId, missionEvidenceRequirements };

export const currentMissionContractMetadata = canonicalMissionContractMetadata;
export const assertCurrentMissionContract = assertCanonicalMissionContract;

function missionPath(missionId) {
  return path.posix.join(ARTIFACT_PATHS.missionsDir, `${missionId}.json`);
}

function fileExists(root, relativePath) {
  const context = currentMutationContext(root);
  return context ? context.fileExists(relativePath) : fs.existsSync(path.join(root, relativePath));
}

function projectIdentitySnapshot(root, workspace, args = {}, mutationMode = "direct-process") {
  const inspection = inspectDoveWorkspace(root);
  if (inspection.healthy) {
    return {
      required: false,
      workspaceBootstrapRequired: false,
      identityDigest: workspaceDigest(inspection.project),
      identity: inspection.project,
      manifest: inspection.manifest,
      workspaceId: inspection.manifest.workspaceId,
      createdAt: inspection.manifest.createdAt,
      documents: null
    };
  }
  if (inspection.state !== "absent") {
    throw workspaceSchemaError(inspection, "Dove mission");
  }
  const goal = normalizeString(args.goal, null);
  const workspaceId = normalizeString(args.workspaceId, null) ?? newWorkspaceId();
  const createdAt = normalizeString(args.createdAt, null) ?? nowIso();
  const documents = createMinimalWorkspaceDocuments({ workspaceId, goal, createdAt });
  const initProposal = initDoveWorkspace(root, {
    goal,
    mutationMode,
    workspaceId,
    createdAt
  });
  return {
    required: true,
    workspaceBootstrapRequired: true,
    identityDigest: workspaceDigest({ manifest: documents.manifest, project: documents.project }),
    identity: documents.project,
    manifest: documents.manifest,
    workspaceId,
    createdAt,
    documents,
    initConfirmArgs: initProposal.confirmation.confirmArgs
  };
}

function fileArtifactIdentity(relativePath, fullPath, stat) {
  return {
    path: relativePath,
    exists: true,
    kind: "file",
    mode: Number(stat.mode),
    sizeBytes: String(stat.size),
    ctimeNs: String(stat.ctimeNs),
    mtimeNs: String(stat.mtimeNs),
    sha256: sha256(fs.readFileSync(fullPath))
  };
}

function directoryArtifactIdentity(relativePath, fullPath) {
  const entries = [];
  const visit = (directoryPath, directoryRelativePath) => {
    for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const entryPath = path.join(directoryPath, entry.name);
      const entryRelativePath = path.posix.join(directoryRelativePath, entry.name);
      const stat = fs.lstatSync(entryPath, { bigint: true });
      const metadata = { path: entryRelativePath, mode: Number(stat.mode), ctimeNs: String(stat.ctimeNs), mtimeNs: String(stat.mtimeNs) };
      if (stat.isSymbolicLink()) {
        throw new Error(`Mission target artifact directories must not contain symbolic links: ${path.posix.join(relativePath, entryRelativePath)}.`);
      } else if (stat.isDirectory()) {
        entries.push({ ...metadata, kind: "directory" });
        visit(entryPath, entryRelativePath);
      } else if (stat.isFile()) {
        entries.push({ ...metadata, kind: "file", sizeBytes: String(stat.size), sha256: sha256(fs.readFileSync(entryPath)) });
      } else {
        entries.push({ ...metadata, kind: "other", sizeBytes: String(stat.size) });
      }
    }
  };
  visit(fullPath, "");
  return {
    path: relativePath,
    exists: true,
    kind: "directory",
    mode: Number(fs.lstatSync(fullPath, { bigint: true }).mode),
    entryCount: entries.length,
    treeDigest: sha256(stableMissionSerialize(entries))
  };
}

function artifactIdentity(root, rawPath) {
  const normalized = normalizeProjectRelativePath(rawPath);
  if (!normalized.ok) {
    throw new Error(`Invalid target artifact ${JSON.stringify(rawPath)}: ${normalized.reason}.`);
  }
  const relativePath = normalized.normalizedPath;
  if (relativePath === ".dove-archive" || relativePath.startsWith(".dove-archive/")) {
    throw new Error("Mission target artifacts must not include preserved .dove-archive state.");
  }
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    resolveCanonicalContainedWrite(root, relativePath, { label: "Mission target artifact path" });
    return { path: relativePath, exists: false };
  }
  const stat = fs.lstatSync(fullPath, { bigint: true });
  if (stat.isSymbolicLink()) {
    throw new Error(`Mission target artifacts must not be symbolic links: ${relativePath}.`);
  }
  resolveCanonicalContainedWrite(root, relativePath, { label: "Mission target artifact path" });
  if (stat.isFile()) {
    return fileArtifactIdentity(relativePath, fullPath, stat);
  }
  if (stat.isDirectory()) {
    return directoryArtifactIdentity(relativePath, fullPath);
  }
  return {
    path: relativePath,
    exists: true,
    kind: "other",
    mode: stat.mode,
    sizeBytes: stat.size
  };
}

function targetArtifactIdentities(root, targetArtifacts, expectedArtifacts = []) {
  const identities = new Map();
  for (const artifactPath of [...targetArtifacts, ...expectedArtifacts]) {
    identities.set(artifactPath, artifactIdentity(root, artifactPath));
  }
  return [...identities.values()];
}

function missionMutationMode(root, args = {}) {
  const explicitMode = Object.hasOwn(args, "mutationMode") ? normalizeMutationMode(args.mutationMode) : null;
  const activeMode = currentMutationContext(root)?.mutationMode ?? null;
  if (activeMode && explicitMode && activeMode !== explicitMode) {
    throw new Error(`Dove mission mutationMode ${explicitMode} does not match the active mutation context mode ${activeMode}.`);
  }
  return activeMode ?? explicitMode ?? "direct-process";
}

function hasConfirmation(args = {}) {
  return args.confirmed === true;
}

function validateProposedMissionGraph(root, projectIdentity, mission) {
  const existing = projectIdentity.required
    ? []
    : [...openDoveWorkspace(root, { operation: "Dove mission graph validation" }).missions.values()];
  validateMissionGraph([
    ...existing.map((item) => ({ filename: `${item.missionId}.json`, mission: item })),
    { filename: `${mission.missionId}.json`, mission }
  ]);
}

function buildMissionProposal(root, args = {}) {
  const workspace = canonicalWorkspace(root);
  const content = missionContractContent(args);
  const missionId = normalizeMissionId(args.missionId, content.goal);
  const contractDigest = missionContractDigest(missionId, content);
  const mutationMode = missionMutationMode(root, args);
  const projectIdentity = projectIdentitySnapshot(root, workspace, {
    goal: content.goal,
    workspaceId: args.workspaceId,
    createdAt: args.createdAt
  }, mutationMode);
  if (!projectIdentity.required) {
    const suppliedWorkspaceId = normalizeString(args.workspaceId, projectIdentity.workspaceId);
    const suppliedCreatedAt = normalizeString(args.createdAt, projectIdentity.createdAt);
    if (suppliedWorkspaceId !== projectIdentity.workspaceId || suppliedCreatedAt !== projectIdentity.createdAt) {
      throw new Error("Dove mission replay no longer matches the current manifest workspace identity.");
    }
  }
  const targetIdentities = targetArtifactIdentities(root, content.targetArtifacts, content.expectedArtifacts);
  const mission = {
    schemaVersion: MISSION_CONTRACT_SCHEMA_VERSION,
    proposalVersion: MISSION_PROPOSAL_VERSION,
    missionId,
    contractDigest,
    ...content,
    completionCriterionIds: missionCompletionCriteria(content).map(({ criterionId }) => criterionId),
    evidenceRequirementIds: missionEvidenceRequirements(content).map(({ requirementId }) => requirementId)
  };
  validateProposedMissionGraph(root, projectIdentity, mission);
  const envelope = {
    proposalVersion: MISSION_PROPOSAL_VERSION,
    workspace,
    mutationMode,
    workspaceSchemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION,
    projectIdentityRequired: projectIdentity.required,
    workspaceBootstrapRequired: projectIdentity.workspaceBootstrapRequired,
    workspaceId: projectIdentity.workspaceId,
    workspaceCreatedAt: projectIdentity.createdAt,
    projectIdentityDigest: projectIdentity.identityDigest,
    targetArtifactIdentities: targetIdentities,
    mission
  };
  const proposalDigest = sha256(stableMissionSerialize(envelope));
  return {
    workspace,
    mutationMode,
    projectIdentity,
    targetIdentities,
    mission,
    content,
    contractDigest,
    proposalDigest
  };
}

function confirmArgsFor(proposal) {
  return {
    confirmed: true,
    proposalVersion: MISSION_PROPOSAL_VERSION,
    proposalWorkspace: proposal.workspace,
    proposalDigest: proposal.proposalDigest,
    mutationMode: proposal.mutationMode,
    workspaceId: proposal.projectIdentity.workspaceId,
    createdAt: proposal.projectIdentity.createdAt,
    missionId: proposal.mission.missionId,
    ...proposal.content
  };
}

function approvalMetadata(proposal) {
  return {
    required: true,
    noChangesApplied: true,
    summary: `Dove can save this mission checkpoint: ${proposal.content.goal}`,
    effects: [
      "Save the approved goal and scope.",
      "Save the expected outcomes and evidence requirements.",
      "Return control to the host to continue the requested work."
    ],
    question: "Create this mission checkpoint and continue the requested work?"
  };
}

function confirmationMetadata(proposal) {
  const confirmArgs = confirmArgsFor(proposal);
  return {
    required: true,
    proposalVersion: MISSION_PROPOSAL_VERSION,
    proposalDigest: proposal.proposalDigest,
    proposalWorkspace: proposal.workspace,
    mutationMode: proposal.mutationMode,
    trustBoundary: "trusted-local-exact-replay-data",
    proofOfHumanApproval: false,
    tamperProof: false,
    confirmArgs,
    proposalToken: Buffer.from(JSON.stringify({ version: MISSION_PROPOSAL_VERSION, mutationMode: proposal.mutationMode, confirmArgs }), "utf8").toString("base64url")
  };
}

function executionHandoff(mission) {
  return {
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    targetArtifacts: mission.targetArtifacts,
    expectedArtifacts: mission.expectedArtifacts,
    completionCriteria: missionCompletionCriteria(mission),
    evidenceRequirements: missionEvidenceRequirements(mission),
    receiptCliTemplate: "node ./bin/dove-package.mjs receipt . --input \"<receipt.json>\" --mutation-mode direct-process --json",
    mcpTools: {
      ingest: "ingest_execution_receipt",
      assess: "assess_mission_completion"
    },
    persisted: false
  };
}

function missionMutationMetadata(proposal, applied) {
  return {
    mutationMode: proposal.mutationMode,
    writesApplied: applied,
    paths: applied ? [
      ...(proposal.projectIdentity.required ? [
        ARTIFACT_PATHS.doveRootManifest,
        ARTIFACT_PATHS.projectIdentity
      ] : []),
      missionPath(proposal.mission.missionId)
    ] : []
  };
}

function assertReplayHeader(proposal, args) {
  const suppliedDigest = normalizeString(args.proposalDigest, "");
  if (!/^[0-9a-f]{64}$/u.test(suppliedDigest) || !normalizeString(args.missionId, null)) {
    throw new Error("Confirmed Dove mission materialization requires the exact proposalDigest and missionId returned by the selected local proposal replay data.");
  }
  if (!currentMutationContext(proposal.workspace)) {
    throw new Error("Confirmed Dove mission materialization requires an active MutationContext; direct core replay cannot write outside the selected mutation mode.");
  }
  if (args.proposalVersion !== MISSION_PROPOSAL_VERSION) {
    throw new Error("The selected local Dove mission proposal replay version is not supported. Request a fresh proposal.");
  }
  if (normalizeString(args.proposalWorkspace, "") !== proposal.workspace) {
    throw new Error("The selected local Dove mission proposal replay belongs to a different canonical workspace. Request a fresh proposal.");
  }
  if (suppliedDigest !== proposal.proposalDigest) {
    throw new Error("The selected local Dove mission proposal replay no longer matches the current contract, target artifact identities, project identity, or exact replay fields. Request a fresh proposal before materialization.");
  }
}

function assertMissionIdAvailable(root, missionId) {
  if (fileExists(root, missionPath(missionId))) {
    throw new Error(`Dove mission id already exists or changed: ${missionId}. Request a fresh proposal.`);
  }
}

function materializeProjectIdentity(root, proposal) {
  if (!proposal.projectIdentity.required) {
    openDoveWorkspace(root, { operation: "Dove mission materialization" });
    return proposal.projectIdentity.identity;
  }
  initDoveWorkspace(root, proposal.projectIdentity.initConfirmArgs);
  return proposal.projectIdentity.identity;
}

function persistedMission(proposal) {
  return {
    schemaVersion: MISSION_CONTRACT_SCHEMA_VERSION,
    workspaceId: proposal.projectIdentity.workspaceId,
    missionId: proposal.mission.missionId,
    contractDigest: proposal.contractDigest,
    createdAt: proposal.projectIdentity.required ? proposal.projectIdentity.createdAt : nowIso(),
    ...proposal.content,
    completionCriterionIds: missionCompletionCriteria(proposal.content).map(({ criterionId }) => criterionId),
    evidenceRequirementIds: missionEvidenceRequirements(proposal.content).map(({ requirementId }) => requirementId)
  };
}

export function previewDoveMissionContract(root, args = {}) {
  assertAllowedFields(args, new Set(MISSION_CONTRACT_INPUT_FIELDS), "Dove mission preview");
  const proposal = buildMissionProposal(root, args);
  return {
    status: "proposal",
    mission: proposal.mission,
    contractDigest: proposal.contractDigest,
    handoffBrief: proposal.content,
    confirmation: { required: false },
    mutation: missionMutationMetadata(proposal, false)
  };
}

export function createDoveMission(root, args = {}) {
  assertGovernanceMutationRegistered("create-dove-mission", "guarded");
  const operation = args.operation ?? "create";
  if (operation === "reevaluate-research-tree") return reevaluateResearchTree(root, args);
  if (operation !== "create") throw new Error("create_dove_mission operation must be create or reevaluate-research-tree.");
  assertAllowedFields(args, new Set([...MISSION_CONTRACT_INPUT_FIELDS, ...MISSION_REPLAY_CONTROL_FIELDS, "operation"]), "create_dove_mission");
  const createArgs = Object.fromEntries(Object.entries(args).filter(([field]) => field !== "operation"));
  const confirmed = hasConfirmation(createArgs);
  const proposal = buildMissionProposal(root, createArgs);
  if (!confirmed) {
    return {
      status: "needs-confirmation",
      mission: proposal.mission,
      contractDigest: proposal.contractDigest,
      handoffBrief: proposal.content,
      approval: approvalMetadata(proposal),
      confirmation: confirmationMetadata(proposal),
      mutation: missionMutationMetadata(proposal, false)
    };
  }
  assertReplayHeader(proposal, createArgs);
  assertMissionIdAvailable(root, proposal.mission.missionId);
  const mission = persistedMission(proposal);
  materializeProjectIdentity(root, proposal);
  writeJson(root, missionPath(mission.missionId), mission);
  const plannedOnly = isPatchPlanMode(root);
  return {
    status: plannedOnly ? "materialization-planned" : "materialized",
    mission,
    contractDigest: proposal.contractDigest,
    handoffBrief: proposal.content,
    executionHandoff: executionHandoff(mission),
    mutation: missionMutationMetadata(proposal, !plannedOnly)
  };
}

export function initDoveGoal(root, args = {}) {
  assertGovernanceMutationRegistered("init-dove-goal", "guarded");
  assertAllowedFields(args, INIT_INPUT_FIELDS, "init_dove_goal");
  return initDoveWorkspace(root, args);
}
