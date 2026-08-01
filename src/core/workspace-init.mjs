import fs from "node:fs";
import path from "node:path";

import { createMissionTransition, missionTransitionPath } from "./mission-lifecycle.mjs";
import { currentMutationContext, normalizeMutationMode } from "./mutation-backend.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import {
  DEFAULT_DOVE_LESSONS_MARKDOWN,
  DOVE_WORKSPACE_SCHEMA_VERSION,
  MINIMAL_WORKSPACE_DIRECTORIES,
  MINIMAL_WORKSPACE_REQUIRED_FILES,
  archiveTargetFor,
  canonicalWorkspacePath,
  createMinimalWorkspaceDocuments,
  inspectDoveSourceTree,
  inspectDoveWorkspace,
  newWorkspaceId,
  openDoveWorkspace,
  stableWorkspaceSerialize,
  workspaceDigest,
  workspaceSchemaError
} from "./workspace-schema.mjs";
import { createWorkspaceRevision, workspaceRevisionPath } from "./workspace-revisions.mjs";

export const DOVE_INIT_PROPOSAL_VERSION = 2;
export const DOVE_REVISE_MAINLINE_OPERATION = "revise-mainline";

const INIT_FIELDS = new Set([
  "operation", "mainline", "changeReason", "archiveReset", "confirmed",
  "proposalVersion", "proposalWorkspace", "proposalDigest", "mutationMode", "workspaceId",
  "createdAt", "detectedState", "detectedSchema", "sourceIdentity", "sourceTreeDigest",
  "archiveTarget", "currentRevisionId", "currentRevisionDigest", "activeMissionIds"
]);

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}

function assertAllowed(args) {
  assertPlainObject(args, "Dove workspace arguments");
  const unknown = Object.keys(args).filter((field) => !INIT_FIELDS.has(field));
  if (unknown.length > 0) throw new Error(`Dove workspace does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}

function text(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

function optionalReplayString(value, label) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !value) throw new Error(`${label} must be a non-empty string or null.`);
  return value;
}

function operationFrom(args) {
  const operation = args.operation ?? "initialize";
  if (!["initialize", DOVE_REVISE_MAINLINE_OPERATION].includes(operation)) throw new Error("Dove workspace operation must be initialize or revise-mainline.");
  return operation;
}

function mutationModeFor(root, args) {
  const explicit = Object.hasOwn(args, "mutationMode") ? normalizeMutationMode(args.mutationMode) : null;
  const active = currentMutationContext(root)?.mutationMode ?? null;
  if (explicit && active && explicit !== active) throw new Error(`Dove workspace mutationMode ${explicit} does not match the active MutationContext mode ${active}.`);
  return active ?? explicit ?? "direct-process";
}

function exactReplayInput(args) {
  const operation = operationFrom(args);
  return {
    operation,
    mainline: text(args.mainline, "Dove workspace research mainline"),
    changeReason: text(args.changeReason, "Dove workspace change reason"),
    archiveReset: args.archiveReset === true,
    confirmed: true,
    proposalVersion: args.proposalVersion,
    proposalWorkspace: optionalReplayString(args.proposalWorkspace, "proposalWorkspace"),
    proposalDigest: optionalReplayString(args.proposalDigest, "proposalDigest"),
    mutationMode: Object.hasOwn(args, "mutationMode") ? normalizeMutationMode(args.mutationMode) : "direct-process",
    workspaceId: optionalReplayString(args.workspaceId, "workspaceId"),
    createdAt: optionalReplayString(args.createdAt, "createdAt"),
    detectedState: optionalReplayString(args.detectedState, "detectedState"),
    detectedSchema: optionalReplayString(args.detectedSchema, "detectedSchema"),
    sourceIdentity: args.sourceIdentity ?? null,
    sourceTreeDigest: optionalReplayString(args.sourceTreeDigest, "sourceTreeDigest"),
    archiveTarget: optionalReplayString(args.archiveTarget, "archiveTarget"),
    currentRevisionId: optionalReplayString(args.currentRevisionId, "currentRevisionId"),
    currentRevisionDigest: optionalReplayString(args.currentRevisionDigest, "currentRevisionDigest"),
    activeMissionIds: Array.isArray(args.activeMissionIds) ? [...args.activeMissionIds] : []
  };
}

function assertArchiveTargetSafe(workspace, archiveTarget) {
  const archiveParent = path.join(workspace, ".dove-archive");
  if (path.dirname(archiveTarget) !== archiveParent) throw new Error("Dove archive target must be the deterministic workspace-local .dove-archive target.");
  if (!fs.existsSync(archiveParent)) return;
  const parentStat = fs.lstatSync(archiveParent);
  if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) throw new Error("Dove archive parent .dove-archive must be a real workspace-local directory, not a symbolic link or file.");
}

function initializeProposal(root, args, workspace, replay) {
  const inspection = inspectDoveWorkspace(workspace);
  const archiveReset = args.archiveReset === true;
  if (archiveReset && inspection.state !== "absent") inspection.source = inspectDoveSourceTree(workspace);
  if (archiveReset) {
    if (inspection.state === "absent" || inspection.healthy) throw new Error("Dove workspace archive-reset applies only to an existing legacy or invalid .dove directory.");
  } else if (inspection.state !== "absent") {
    if (inspection.healthy) throw new Error("Dove workspace is already initialized. Use revise-mainline to change its research mainline.");
    throw workspaceSchemaError(inspection, "Dove workspace initialization");
  }
  const mainline = text(args.mainline, "Dove workspace research mainline");
  const changeReason = typeof args.changeReason === "string" && args.changeReason.trim()
    ? args.changeReason.trim()
    : "Establish the initial research mainline.";
  const mutationMode = mutationModeFor(workspace, args);
  if (archiveReset && mutationMode === "patch-plan") throw new Error("Dove workspace archive-reset requires direct-process transaction semantics.");
  const workspaceId = replay?.workspaceId ?? (typeof args.workspaceId === "string" && args.workspaceId ? args.workspaceId : newWorkspaceId());
  const createdAt = replay?.createdAt ?? (typeof args.createdAt === "string" && args.createdAt ? args.createdAt : new Date().toISOString());
  const archiveTarget = archiveReset ? archiveTargetFor({ workspace, detectedSchema: inspection.detectedSchema, treeDigest: inspection.source.treeDigest }) : null;
  if (archiveTarget) assertArchiveTargetSafe(workspace, archiveTarget);
  const documents = createMinimalWorkspaceDocuments({ workspaceId, mainline, changeReason, createdAt });
  return {
    envelope: {
      proposalVersion: DOVE_INIT_PROPOSAL_VERSION,
      operation: "initialize",
      workspace,
      mutationMode,
      workspaceId,
      createdAt,
      mainline,
      changeReason,
      archiveReset,
      detectedState: inspection.state,
      detectedSchema: inspection.detectedSchema,
      sourceIdentity: inspection.source?.identity ?? null,
      sourceTreeDigest: inspection.source?.treeDigest ?? null,
      archiveTarget,
      currentRevisionId: null,
      currentRevisionDigest: null,
      activeMissionIds: [],
      newSchemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION
    },
    inspection,
    documents,
    workspaceRevision: documents.workspaceRevision,
    transitions: []
  };
}

function reviseProposal(root, args, workspace, replay) {
  if (args.archiveReset === true) throw new Error("revise-mainline does not accept archiveReset.");
  const opened = openDoveWorkspace(workspace, { operation: "Dove workspace mainline revision" });
  const current = opened.currentWorkspaceRevision;
  const mainline = text(args.mainline, "Dove workspace research mainline");
  const changeReason = text(args.changeReason, "Dove workspace mainline change reason");
  if (mainline === current.mainline) throw new Error("revise-mainline must change the research mainline.");
  const source = inspectDoveSourceTree(workspace);
  const mutationMode = mutationModeFor(workspace, args);
  const createdAt = replay?.createdAt ?? (typeof args.createdAt === "string" && args.createdAt ? args.createdAt : new Date().toISOString());
  const workspaceRevision = createWorkspaceRevision({
    workspaceId: opened.manifest.workspaceId,
    revision: current.revision + 1,
    previousRevisionId: current.revisionId,
    previousRevisionDigest: current.revisionDigest,
    mainline,
    changeReason,
    createdAt
  });
  const activeMissions = [...opened.missions.values()]
    .filter((mission) => mission.workspaceRevisionId === current.revisionId && !opened.missionTransitions.has(mission.missionId))
    .sort((left, right) => left.missionId.localeCompare(right.missionId));
  const transitions = activeMissions.map((mission) => createMissionTransition({
    workspaceId: opened.manifest.workspaceId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    workspaceRevisionId: current.revisionId,
    status: "stopped",
    reason: `The user explicitly changed the workspace research mainline: ${changeReason}`,
    evidenceRefs: [],
    trigger: "workspace-revision",
    createdAt
  }));
  return {
    envelope: {
      proposalVersion: DOVE_INIT_PROPOSAL_VERSION,
      operation: DOVE_REVISE_MAINLINE_OPERATION,
      workspace,
      mutationMode,
      workspaceId: opened.manifest.workspaceId,
      createdAt,
      mainline,
      changeReason,
      archiveReset: false,
      detectedState: opened.state,
      detectedSchema: opened.detectedSchema,
      sourceIdentity: source.identity,
      sourceTreeDigest: source.treeDigest,
      archiveTarget: null,
      currentRevisionId: current.revisionId,
      currentRevisionDigest: current.revisionDigest,
      activeMissionIds: activeMissions.map((mission) => mission.missionId),
      newSchemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION
    },
    inspection: opened,
    documents: null,
    workspaceRevision,
    transitions
  };
}

function confirmArgs(envelope, proposalDigest) {
  return {
    operation: envelope.operation,
    mainline: envelope.mainline,
    changeReason: envelope.changeReason,
    archiveReset: envelope.archiveReset,
    confirmed: true,
    proposalVersion: envelope.proposalVersion,
    proposalWorkspace: envelope.workspace,
    proposalDigest,
    mutationMode: envelope.mutationMode,
    workspaceId: envelope.workspaceId,
    createdAt: envelope.createdAt,
    detectedState: envelope.detectedState,
    detectedSchema: envelope.detectedSchema,
    sourceIdentity: envelope.sourceIdentity,
    sourceTreeDigest: envelope.sourceTreeDigest,
    archiveTarget: envelope.archiveTarget,
    currentRevisionId: envelope.currentRevisionId,
    currentRevisionDigest: envelope.currentRevisionDigest,
    activeMissionIds: envelope.activeMissionIds
  };
}

function buildProposal(root, args = {}) {
  const workspace = canonicalWorkspacePath(root);
  const replay = args.confirmed === true ? exactReplayInput(args) : null;
  if (replay && replay.proposalVersion !== DOVE_INIT_PROPOSAL_VERSION) throw new Error("The selected Dove workspace proposal version is unsupported. Request a fresh proposal.");
  if (replay && replay.proposalWorkspace !== workspace) throw new Error("The selected Dove workspace proposal belongs to a different canonical workspace. Request a fresh proposal.");
  const operation = operationFrom(args);
  const proposal = operation === DOVE_REVISE_MAINLINE_OPERATION
    ? reviseProposal(root, args, workspace, replay)
    : initializeProposal(root, args, workspace, replay);
  proposal.proposalDigest = workspaceDigest(proposal.envelope);
  return proposal;
}

function proposalOperations(proposal) {
  if (proposal.envelope.operation === DOVE_REVISE_MAINLINE_OPERATION) {
    return [
      { type: "append-sealed-json", path: workspaceRevisionPath(proposal.workspaceRevision.revisionId) },
      ...proposal.transitions.map((transition) => ({ type: "append-sealed-json", path: missionTransitionPath(transition.transitionId) })),
      { type: "write-sealed-json", path: ARTIFACT_PATHS.projectIdentity }
    ];
  }
  const initialize = [
    ...MINIMAL_WORKSPACE_DIRECTORIES.map((relativePath) => ({ type: "create-directory", path: relativePath })),
    ...MINIMAL_WORKSPACE_REQUIRED_FILES.map((relativePath) => ({ type: relativePath === ARTIFACT_PATHS.lessonsDocument ? "write-markdown" : "write-sealed-json", path: relativePath })),
    { type: "write-sealed-json", path: workspaceRevisionPath(proposal.workspaceRevision.revisionId) }
  ];
  return proposal.envelope.archiveReset
    ? [{ type: "atomic-directory-rename", from: ".dove", to: path.relative(proposal.envelope.workspace, proposal.envelope.archiveTarget).split(path.sep).join("/") }, ...initialize]
    : initialize;
}

function mutationPaths(proposal) {
  if (proposal.envelope.operation === DOVE_REVISE_MAINLINE_OPERATION) {
    return [workspaceRevisionPath(proposal.workspaceRevision.revisionId), ...proposal.transitions.map((transition) => missionTransitionPath(transition.transitionId)), ARTIFACT_PATHS.projectIdentity];
  }
  return [
    ...(proposal.envelope.archiveReset ? [".dove", path.relative(proposal.envelope.workspace, proposal.envelope.archiveTarget).split(path.sep).join("/")] : []),
    ...MINIMAL_WORKSPACE_REQUIRED_FILES,
    workspaceRevisionPath(proposal.workspaceRevision.revisionId)
  ];
}

function proposalResult(proposal) {
  const replay = confirmArgs(proposal.envelope, proposal.proposalDigest);
  const revise = proposal.envelope.operation === DOVE_REVISE_MAINLINE_OPERATION;
  return {
    status: "needs-confirmation",
    kind: revise ? "workspace-revision" : proposal.envelope.archiveReset ? "archive-reset" : "init",
    workspace: proposal.envelope.workspace,
    detectedSchemaState: { state: proposal.envelope.detectedState, detectedSchema: proposal.envelope.detectedSchema },
    source: proposal.envelope.archiveReset ? { path: ".dove", identity: proposal.envelope.sourceIdentity, treeDigest: proposal.envelope.sourceTreeDigest } : null,
    archiveTarget: proposal.envelope.archiveTarget,
    newSchemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION,
    operations: proposalOperations(proposal),
    proposalDigest: proposal.proposalDigest,
    approval: {
      required: true,
      noChangesApplied: true,
      summary: revise
        ? "Dove can append the user-approved research mainline revision while preserving the previous mission graph and scientific decisions."
        : proposal.envelope.archiveReset
          ? "Dove can replace invalid project records and establish the approved research mainline."
          : "Dove can create project records and establish the approved research mainline.",
      effects: revise
        ? ["Append one immutable workspace revision.", `Stop ${proposal.transitions.length} active mission${proposal.transitions.length === 1 ? "" : "s"} bound to the previous mainline.`, "Preserve all previous missions, evidence, artifacts, and lessons."]
        : proposal.envelope.archiveReset
          ? ["Archive the invalid Dove project records.", "Create clean minimal project records.", "Save the initial research mainline revision."]
          : ["Create minimal Dove project records.", "Save the initial research mainline revision."],
      question: revise ? "Apply this research mainline revision?" : proposal.envelope.archiveReset ? "Replace the invalid Dove project records and initialize this workspace?" : "Create Dove workspace records for this project?"
    },
    confirmation: { required: true, exactReplay: true, confirmArgs: replay },
    mutation: { mutationMode: proposal.envelope.mutationMode, writesApplied: false, paths: [] }
  };
}

function assertExactReplay(proposal, args) {
  const replay = exactReplayInput(args);
  const expected = confirmArgs(proposal.envelope, proposal.proposalDigest);
  if (stableWorkspaceSerialize(replay) !== stableWorkspaceSerialize(expected)) throw new Error("The selected Dove workspace proposal no longer matches the approved exact replay fields. Request a fresh proposal.");
  if (proposal.envelope.archiveReset && fs.existsSync(proposal.envelope.archiveTarget)) throw new Error(`Archive target is already occupied: ${proposal.envelope.archiveTarget}. Request a fresh proposal.`);
}

export function previewDoveInit(root, args = {}) {
  assertAllowed(args);
  if (args.confirmed === true) throw new Error("previewDoveInit does not accept confirmed replay.");
  return proposalResult(buildProposal(root, args));
}

function stageInitialization(context, proposal) {
  if (proposal.envelope.archiveReset) context.replaceDirectory(".dove", { archiveTarget: path.relative(proposal.envelope.workspace, proposal.envelope.archiveTarget).split(path.sep).join("/") });
  else if (context.mutationMode === "direct-process") context.replaceDirectory(".dove");
  for (const relativePath of MINIMAL_WORKSPACE_DIRECTORIES) context.ensureDirectory(relativePath);
  context.writeJson(ARTIFACT_PATHS.doveRootManifest, proposal.documents.manifest);
  context.writeJson(ARTIFACT_PATHS.projectIdentity, proposal.documents.project);
  context.writeText(ARTIFACT_PATHS.lessonsDocument, DEFAULT_DOVE_LESSONS_MARKDOWN);
  context.writeJson(workspaceRevisionPath(proposal.workspaceRevision.revisionId), proposal.workspaceRevision);
}

function stageRevision(context, proposal) {
  const opened = openDoveWorkspace(proposal.envelope.workspace, { operation: "Confirmed Dove workspace mainline revision" });
  if (opened.currentWorkspaceRevision.revisionId !== proposal.envelope.currentRevisionId || opened.currentWorkspaceRevision.revisionDigest !== proposal.envelope.currentRevisionDigest) {
    throw new Error("The workspace mainline changed after approval. Request a fresh proposal.");
  }
  const activeMissionIds = [...opened.missions.values()].filter((mission) => mission.workspaceRevisionId === opened.currentWorkspaceRevision.revisionId && !opened.missionTransitions.has(mission.missionId)).map((mission) => mission.missionId).sort();
  if (stableWorkspaceSerialize(activeMissionIds) !== stableWorkspaceSerialize(proposal.envelope.activeMissionIds)) throw new Error("The active mission set changed after approval. Request a fresh proposal.");
  context.requireCommitPrecondition(ARTIFACT_PATHS.projectIdentity);
  context.requireCommitPrecondition(ARTIFACT_PATHS.workspaceRevisionsDir);
  context.requireCommitPrecondition(ARTIFACT_PATHS.missionTransitionsDir);
  context.writeJson(workspaceRevisionPath(proposal.workspaceRevision.revisionId), proposal.workspaceRevision);
  for (const transition of proposal.transitions) context.writeJson(missionTransitionPath(transition.transitionId), transition);
  context.writeJson(ARTIFACT_PATHS.projectIdentity, {
    ...opened.project,
    currentRevisionId: proposal.workspaceRevision.revisionId,
    currentRevisionDigest: proposal.workspaceRevision.revisionDigest,
    updatedAt: proposal.workspaceRevision.createdAt
  });
}

export function initDoveWorkspace(root, args = {}) {
  assertAllowed(args);
  const proposal = buildProposal(root, args);
  if (args.confirmed !== true) return proposalResult(proposal);
  assertExactReplay(proposal, args);
  const context = currentMutationContext(root);
  if (!context) throw new Error("Confirmed Dove workspace change requires an active MutationContext.");
  const plannedOnly = context.mutationMode === "patch-plan";
  if (proposal.envelope.archiveReset && plannedOnly) throw new Error("Confirmed Dove archive-reset requires direct-process transaction semantics.");
  if (proposal.envelope.operation === DOVE_REVISE_MAINLINE_OPERATION) stageRevision(context, proposal);
  else stageInitialization(context, proposal);
  const paths = mutationPaths(proposal);
  return {
    status: plannedOnly ? (proposal.envelope.operation === DOVE_REVISE_MAINLINE_OPERATION ? "revision-planned" : "initialization-planned") : proposal.envelope.operation === DOVE_REVISE_MAINLINE_OPERATION ? "revised" : proposal.envelope.archiveReset ? "archive-reset-complete" : "initialized",
    kind: proposal.envelope.operation === DOVE_REVISE_MAINLINE_OPERATION ? "workspace-revision" : proposal.envelope.archiveReset ? "archive-reset" : "init",
    workspaceRevision: proposal.workspaceRevision,
    stoppedMissionCount: proposal.transitions.length,
    ...(proposal.documents ? { manifest: proposal.documents.manifest, project: proposal.documents.project } : {}),
    archiveTarget: proposal.envelope.archiveTarget,
    mutation: { mutationMode: proposal.envelope.mutationMode, writesApplied: !plannedOnly, paths: plannedOnly ? [] : paths },
    writes: plannedOnly ? [] : paths
  };
}
