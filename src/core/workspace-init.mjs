import fs from "node:fs";
import path from "node:path";

import { currentMutationContext, normalizeMutationMode } from "./mutation-backend.mjs";
import {
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

export const DOVE_INIT_PROPOSAL_VERSION = 1;

const INIT_FIELDS = new Set([
  "goal",
  "archiveReset",
  "confirmed",
  "proposalVersion",
  "proposalWorkspace",
  "proposalDigest",
  "mutationMode",
  "workspaceId",
  "createdAt",
  "detectedState",
  "detectedSchema",
  "sourceIdentity",
  "sourceTreeDigest",
  "archiveTarget"
]);

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}

function assertAllowed(args) {
  assertPlainObject(args, "dove init arguments");
  const unknown = Object.keys(args).filter((field) => !INIT_FIELDS.has(field));
  if (unknown.length > 0) throw new Error(`dove init does not accept unknown input: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}

function goalFrom(args) {
  const goal = typeof args.goal === "string" ? args.goal.trim() : "";
  if (!goal) throw new Error("Dove init requires a non-empty goal.");
  return goal;
}

function mutationModeFor(root, args) {
  const explicit = Object.hasOwn(args, "mutationMode") ? normalizeMutationMode(args.mutationMode) : null;
  const active = currentMutationContext(root)?.mutationMode ?? null;
  if (explicit && active && explicit !== active) throw new Error(`Dove init mutationMode ${explicit} does not match the active MutationContext mode ${active}.`);
  return active ?? explicit ?? "direct-process";
}

function optionalReplayString(value, label) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !value) throw new Error(`${label} must be a non-empty string or null.`);
  return value;
}

function exactReplayInput(args) {
  return {
    goal: goalFrom(args),
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
    archiveTarget: optionalReplayString(args.archiveTarget, "archiveTarget")
  };
}

function proposalEnvelope({ workspace, mutationMode, workspaceId, createdAt, goal, inspection, archiveReset, archiveTarget }) {
  return {
    proposalVersion: DOVE_INIT_PROPOSAL_VERSION,
    workspace,
    mutationMode,
    workspaceId,
    createdAt,
    goal,
    archiveReset,
    detectedState: inspection.state,
    detectedSchema: inspection.detectedSchema,
    sourceIdentity: inspection.source?.identity ?? null,
    sourceTreeDigest: inspection.source?.treeDigest ?? null,
    archiveTarget: archiveTarget ?? null,
    newSchemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION
  };
}

function assertArchiveTargetSafe(workspace, archiveTarget) {
  const archiveParent = path.join(workspace, ".dove-archive");
  if (path.dirname(archiveTarget) !== archiveParent) {
    throw new Error("Dove archive target must be the deterministic workspace-local .dove-archive target.");
  }
  if (!fs.existsSync(archiveParent)) return;
  const parentStat = fs.lstatSync(archiveParent);
  if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
    throw new Error("Dove archive parent .dove-archive must be a real workspace-local directory, not a symbolic link or file.");
  }
}

function proposalOperations(envelope) {
  const initialize = [
    ...MINIMAL_WORKSPACE_DIRECTORIES.map((relativePath) => ({ type: "create-directory", path: relativePath })),
    ...MINIMAL_WORKSPACE_REQUIRED_FILES.map((relativePath) => ({ type: "write-sealed-json", path: relativePath }))
  ];
  return envelope.archiveReset
    ? [
      { type: "atomic-directory-rename", from: ".dove", to: path.relative(envelope.workspace, envelope.archiveTarget).split(path.sep).join("/") },
      ...initialize
    ]
    : initialize;
}

function confirmArgs(envelope, proposalDigest) {
  return {
    goal: envelope.goal,
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
    archiveTarget: envelope.archiveTarget
  };
}

function buildProposal(root, args = {}) {
  const workspace = canonicalWorkspacePath(root);
  const replay = args.confirmed === true ? exactReplayInput(args) : null;
  if (replay && replay.proposalVersion !== DOVE_INIT_PROPOSAL_VERSION) {
    throw new Error("The selected Dove init proposal version is unsupported. Request a fresh proposal.");
  }
  if (replay && replay.proposalWorkspace !== workspace) {
    throw new Error("The selected Dove init proposal belongs to a different canonical workspace. Request a fresh proposal.");
  }
  const inspection = inspectDoveWorkspace(workspace);
  const archiveReset = args.archiveReset === true;
  if (archiveReset && inspection.state !== "absent") {
    inspection.source = inspectDoveSourceTree(workspace);
  }
  if (archiveReset) {
    if (inspection.state === "absent" || inspection.healthy) {
      throw new Error("dove init --archive-reset applies only when an existing legacy or invalid .dove directory requires explicit replacement.");
    }
  } else if (inspection.state !== "absent") {
    if (inspection.healthy) throw new Error("Dove workspace is already initialized with the current schema.");
    throw workspaceSchemaError(inspection, "dove init");
  }
  const goal = goalFrom(args);
  const mutationMode = mutationModeFor(workspace, args);
  if (archiveReset && mutationMode === "patch-plan") {
    throw new Error("dove init --archive-reset cannot run in patch-plan mode because a patch plan cannot express the required atomic directory rename and rollback semantics. Use direct-process and an exact confirmation replay.");
  }
  const workspaceId = replay?.workspaceId ?? (typeof args.workspaceId === "string" && args.workspaceId ? args.workspaceId : newWorkspaceId());
  const createdAt = replay?.createdAt ?? (typeof args.createdAt === "string" && args.createdAt ? args.createdAt : new Date().toISOString());
  const archiveTarget = archiveReset
    ? archiveTargetFor({ workspace, detectedSchema: inspection.detectedSchema, treeDigest: inspection.source.treeDigest })
    : null;
  if (archiveReset) assertArchiveTargetSafe(workspace, archiveTarget);
  const envelope = proposalEnvelope({ workspace, mutationMode, workspaceId, createdAt, goal, inspection, archiveReset, archiveTarget });
  const proposalDigest = workspaceDigest(envelope);
  return { envelope, proposalDigest, inspection, documents: createMinimalWorkspaceDocuments({ workspaceId, goal, createdAt }) };
}

function mutationMetadata(proposal, writesApplied) {
  return {
    mutationMode: proposal.envelope.mutationMode,
    writesApplied,
    paths: writesApplied ? [
      ...(proposal.envelope.archiveReset ? [".dove", path.relative(proposal.envelope.workspace, proposal.envelope.archiveTarget).split(path.sep).join("/")] : []),
      ...MINIMAL_WORKSPACE_REQUIRED_FILES
    ] : []
  };
}

function proposalResult(proposal) {
  const args = confirmArgs(proposal.envelope, proposal.proposalDigest);
  return {
    status: "needs-confirmation",
    kind: proposal.envelope.archiveReset ? "archive-reset" : "init",
    workspace: proposal.envelope.workspace,
    detectedSchemaState: {
      state: proposal.envelope.detectedState,
      detectedSchema: proposal.envelope.detectedSchema
    },
    source: proposal.envelope.archiveReset ? {
      path: ".dove",
      identity: proposal.envelope.sourceIdentity,
      treeDigest: proposal.envelope.sourceTreeDigest
    } : null,
    archiveTarget: proposal.envelope.archiveTarget,
    newSchemaVersion: DOVE_WORKSPACE_SCHEMA_VERSION,
    operations: proposalOperations(proposal.envelope),
    proposalDigest: proposal.proposalDigest,
    confirmation: {
      required: true,
      exactReplay: true,
      proposalVersion: DOVE_INIT_PROPOSAL_VERSION,
      proposalWorkspace: proposal.envelope.workspace,
      proposalDigest: proposal.proposalDigest,
      mutationMode: proposal.envelope.mutationMode,
      confirmArgs: args,
      proposalToken: Buffer.from(JSON.stringify({ version: DOVE_INIT_PROPOSAL_VERSION, confirmArgs: args }), "utf8").toString("base64url")
    },
    mutation: mutationMetadata(proposal, false)
  };
}

function assertExactReplay(proposal, args) {
  if (args.confirmed !== true) return;
  const replay = exactReplayInput(args);
  const expectedArgs = confirmArgs(proposal.envelope, proposal.proposalDigest);
  if (stableWorkspaceSerialize(replay) !== stableWorkspaceSerialize(expectedArgs)) {
    throw new Error("The selected Dove init proposal no longer matches the approved proposal replay fields exactly. Request a fresh proposal.");
  }
  if (replay.proposalDigest !== proposal.proposalDigest) throw new Error("The selected Dove init proposal no longer matches the exact workspace, source tree, archive target, goal, schema version, or mutation mode. Request a fresh proposal.");
  if (proposal.envelope.archiveReset) {
    const archiveTarget = proposal.envelope.archiveTarget;
    if (fs.existsSync(archiveTarget)) throw new Error(`Archive target is already occupied: ${archiveTarget}. Request a fresh proposal.`);
    const source = inspectDoveSourceTree(proposal.envelope.workspace);
    if (!source || stableWorkspaceSerialize(source.identity) !== stableWorkspaceSerialize(proposal.envelope.sourceIdentity) || source.treeDigest !== proposal.envelope.sourceTreeDigest) {
      throw new Error("The .dove source identity or tree digest changed after proposal. Request a fresh archive-reset proposal.");
    }
  }
}

export function previewDoveInit(root, args = {}) {
  assertAllowed(args);
  if (args.confirmed === true) throw new Error("previewDoveInit does not accept confirmed replay.");
  return proposalResult(buildProposal(root, args));
}

function stageDoveInitialization(context, proposal) {
  if (proposal.envelope.archiveReset) {
    context.replaceDirectory(".dove", {
      archiveTarget: path.relative(proposal.envelope.workspace, proposal.envelope.archiveTarget).split(path.sep).join("/")
    });
  } else {
    context.replaceDirectory(".dove");
  }
  for (const relativePath of MINIMAL_WORKSPACE_DIRECTORIES) context.ensureDirectory(relativePath);
  context.writeJson(".dove/manifest.json", proposal.documents.manifest);
  context.writeJson(".dove/project.json", proposal.documents.project);
}

export function initDoveWorkspace(root, args = {}, options = {}) {
  assertAllowed(args);
  const proposal = buildProposal(root, args);
  if (args.confirmed !== true) return proposalResult(proposal);
  assertExactReplay(proposal, args);
  if (!currentMutationContext(root)) throw new Error("Confirmed Dove init requires an active MutationContext.");
  if (proposal.envelope.archiveReset && proposal.envelope.mutationMode === "patch-plan") {
    throw new Error("Confirmed Dove archive-reset cannot claim patch-plan writes: the required atomic directory rename and rollback are direct-process only.");
  }
  const context = currentMutationContext(root);
  if (proposal.envelope.mutationMode === "patch-plan") {
    for (const relativePath of MINIMAL_WORKSPACE_DIRECTORIES) context.ensureDirectory(relativePath);
    context.writeJson(".dove/manifest.json", proposal.documents.manifest);
    context.writeJson(".dove/project.json", proposal.documents.project);
    return {
      status: "initialization-planned",
      kind: "init",
      manifest: proposal.documents.manifest,
      project: proposal.documents.project,
      archiveTarget: null,
      mutation: mutationMetadata(proposal, false),
      writes: []
    };
  }
  stageDoveInitialization(context, proposal);
  return {
    status: proposal.envelope.archiveReset ? "archive-reset-complete" : "initialized",
    kind: proposal.envelope.archiveReset ? "archive-reset" : "init",
    manifest: proposal.documents.manifest,
    project: proposal.documents.project,
    archiveTarget: proposal.envelope.archiveTarget,
    mutation: mutationMetadata(proposal, true),
    writes: MINIMAL_WORKSPACE_REQUIRED_FILES
  };
}
