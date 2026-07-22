import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  assertSealedDomainArgs,
  domainJson,
  domainNonEmptyText,
  domainSafeId,
  domainSha256,
  domainStringArray,
  finalizeDomainArtifacts,
  readCurrentMission,
  resolveMissionArtifactReferences,
  resolveMissionValidationReference
} from "./domain-artifacts.mjs";
import { currentMutationContext, normalizeMutationMode } from "./mutation-backend.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import { evaluateNoteReferences, evaluateSourceReferences } from "./source-trust.mjs";
import { readJson } from "./workspace.mjs";
import { canonicalWorkspacePath, stableWorkspaceSerialize } from "./workspace-schema.mjs";

export const RESEARCH_TREE_SCHEMA_VERSION = 1;
export const RESEARCH_TREE_PROPOSAL_VERSION = 1;
export const RESEARCH_TREE_NODE_STATUSES = Object.freeze(["pending", "completed", "blocked"]);
export const RESEARCH_TREE_WORK_KINDS = Object.freeze(["retrieval", "experiment", "analysis"]);

const STATUS_SET = new Set(RESEARCH_TREE_NODE_STATUSES);
const WORK_KIND_SET = new Set(RESEARCH_TREE_WORK_KINDS);
const REEVALUATE_FIELDS = new Set(["operation", "missionId", "requirement", "nodeUpdates"]);
const REPLAY_FIELDS = new Set([
  "confirmed",
  "proposalVersion",
  "proposalWorkspace",
  "proposalDigest",
  "proposalToken",
  "mutationMode",
  "workspaceId",
  "contractDigest",
  "createdAt",
  "receiptId"
]);
const NODE_FIELDS = new Set([
  "nodeId",
  "parentNodeId",
  "workKind",
  "questionOrHypothesis",
  "workDescription",
  "successOrStopCriterion",
  "status",
  "outcomeSummary",
  "outcomeEvidenceRefs",
  "blockedReasonCode",
  "lessonId",
  "createdAt",
  "updatedAt"
]);
const NODE_INPUT_FIELDS = new Set([...NODE_FIELDS].filter((field) => field !== "createdAt" && field !== "updatedAt"));
const TREE_FIELDS = new Set(["schemaVersion", "workspaceId", "missionId", "contractDigest", "revision", "nodes", "updatedAt"]);

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be a plain object.`);
}

function assertSealed(value, fields, label) {
  assertPlainObject(value, label);
  const unknown = Object.keys(value).filter((field) => !fields.has(field));
  if (unknown.length > 0) throw new Error(`${label} does not accept unknown fields: ${unknown.map((field) => `$.${field}`).join(", ")}.`);
}

function exactIso(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value) throw new Error(`${label} must be an exact ISO-8601 timestamp.`);
  return value;
}

function nullableSafeId(value, label) {
  if (value === null) return null;
  return domainSafeId(value, label);
}

function normalizeWorkKind(value, label) {
  const workKind = domainNonEmptyText(value, label).toLowerCase();
  if (!WORK_KIND_SET.has(workKind)) throw new Error(`${label} must be retrieval, experiment, or analysis.`);
  return workKind;
}

function normalizeStatus(value, label) {
  const status = domainNonEmptyText(value, label).toLowerCase();
  if (!STATUS_SET.has(status)) throw new Error(`${label} is unsupported.`);
  return status;
}

function normalizeOutcomeFields(value, label, status, options = {}) {
  const evidenceRefs = domainStringArray(value.outcomeEvidenceRefs, `${label}.outcomeEvidenceRefs`);
  if (status === "pending") {
    if (value.outcomeSummary !== null || evidenceRefs.length !== 0 || value.blockedReasonCode !== null || value.lessonId !== null) {
      throw new Error(`${label} pending nodes require null outcomeSummary, blockedReasonCode, and lessonId with empty outcomeEvidenceRefs.`);
    }
    return { outcomeSummary: null, outcomeEvidenceRefs: [], blockedReasonCode: null, lessonId: null };
  }
  const outcomeSummary = domainNonEmptyText(value.outcomeSummary, `${label}.outcomeSummary`);
  if (evidenceRefs.length === 0) throw new Error(`${label} ${status} nodes require at least one current outcomeEvidenceRef.`);
  if (status === "completed") {
    if (value.blockedReasonCode !== null || value.lessonId !== null) throw new Error(`${label} completed nodes must keep blockedReasonCode and lessonId null.`);
    return { outcomeSummary, outcomeEvidenceRefs: evidenceRefs, blockedReasonCode: null, lessonId: null };
  }
  const blockedReasonCode = domainSafeId(value.blockedReasonCode, `${label}.blockedReasonCode`);
  const lessonId = options.allowUnassignedBlockedLesson === true && value.lessonId === null
    ? null
    : domainSafeId(value.lessonId, `${label}.lessonId`);
  return { outcomeSummary, outcomeEvidenceRefs: evidenceRefs, blockedReasonCode, lessonId };
}

function normalizeNode(value, label, options = {}) {
  assertSealed(value, options.persisted === true ? NODE_FIELDS : NODE_INPUT_FIELDS, label);
  const status = normalizeStatus(value.status, `${label}.status`);
  const outcome = normalizeOutcomeFields(value, label, status, options);
  return {
    nodeId: domainSafeId(value.nodeId, `${label}.nodeId`),
    parentNodeId: nullableSafeId(value.parentNodeId, `${label}.parentNodeId`),
    workKind: normalizeWorkKind(value.workKind, `${label}.workKind`),
    questionOrHypothesis: domainNonEmptyText(value.questionOrHypothesis, `${label}.questionOrHypothesis`),
    workDescription: domainNonEmptyText(value.workDescription, `${label}.workDescription`),
    successOrStopCriterion: domainNonEmptyText(value.successOrStopCriterion, `${label}.successOrStopCriterion`),
    status,
    ...outcome,
    ...(options.persisted === true ? {
      createdAt: exactIso(value.createdAt, `${label}.createdAt`),
      updatedAt: exactIso(value.updatedAt, `${label}.updatedAt`)
    } : {})
  };
}

function sameImmutableNodeFields(left, right) {
  return left.parentNodeId === right.parentNodeId
    && left.workKind === right.workKind
    && left.questionOrHypothesis === right.questionOrHypothesis
    && left.workDescription === right.workDescription
    && left.successOrStopCriterion === right.successOrStopCriterion;
}

function sameOutcome(left, right) {
  return left.status === right.status
    && left.outcomeSummary === right.outcomeSummary
    && stableWorkspaceSerialize(left.outcomeEvidenceRefs) === stableWorkspaceSerialize(right.outcomeEvidenceRefs)
    && left.blockedReasonCode === right.blockedReasonCode
    && left.lessonId === right.lessonId;
}

function assertTreeGraph(nodes, label = "Research tree") {
  const byId = new Map();
  for (const node of nodes) {
    if (byId.has(node.nodeId)) throw new Error(`${label} contains duplicate nodeId ${node.nodeId}.`);
    byId.set(node.nodeId, node);
  }
  for (const node of nodes) {
    if (node.parentNodeId === null) continue;
    if (node.parentNodeId === node.nodeId) throw new Error(`${label} node ${node.nodeId} must not parent itself.`);
    if (!byId.has(node.parentNodeId)) throw new Error(`${label} node ${node.nodeId} references unknown parent ${node.parentNodeId}.`);
  }
  for (const node of nodes) {
    const seen = new Set();
    let cursor = node;
    while (cursor?.parentNodeId !== null) {
      if (seen.has(cursor.nodeId)) throw new Error(`${label} contains a cycle at ${cursor.nodeId}.`);
      seen.add(cursor.nodeId);
      cursor = byId.get(cursor.parentNodeId);
    }
  }
}

export function validateResearchTree(value, options = {}) {
  const label = options.label ?? "Research tree";
  assertSealed(value, TREE_FIELDS, label);
  if (value.schemaVersion !== RESEARCH_TREE_SCHEMA_VERSION) throw new Error(`${label} has an unsupported schemaVersion.`);
  const workspaceId = domainSafeId(value.workspaceId, `${label}.workspaceId`);
  const missionId = domainSafeId(value.missionId, `${label}.missionId`);
  if (options.workspaceId !== undefined && workspaceId !== options.workspaceId) throw new Error(`${label}.workspaceId does not match the manifest workspaceId.`);
  if (options.missionId !== undefined && missionId !== options.missionId) throw new Error(`${label}.missionId does not match its filename.`);
  if (options.contractDigest !== undefined && value.contractDigest !== options.contractDigest) throw new Error(`${label}.contractDigest does not match mission ${missionId}.`);
  if (!/^[0-9a-f]{64}$/u.test(String(value.contractDigest ?? ""))) throw new Error(`${label}.contractDigest must be a lowercase SHA-256 digest.`);
  if (!Number.isSafeInteger(value.revision) || value.revision < 1) throw new Error(`${label}.revision must be a positive safe integer.`);
  exactIso(value.updatedAt, `${label}.updatedAt`);
  if (!Array.isArray(value.nodes) || value.nodes.length === 0) throw new Error(`${label}.nodes must contain at least one decision node.`);
  const nodes = value.nodes.map((node, index) => {
    const normalized = normalizeNode(node, `${label}.nodes[${index}]`, { persisted: true });
    if (Date.parse(normalized.updatedAt) < Date.parse(normalized.createdAt)) throw new Error(`${label}.nodes[${index}].updatedAt must not precede createdAt.`);
    return normalized;
  });
  assertTreeGraph(nodes, label);
  return { ...value, nodes };
}

export function researchTreePath(missionId) {
  return path.posix.join(ARTIFACT_PATHS.researchTreesDir, `${domainSafeId(missionId, "missionId")}.json`);
}

export function readResearchTree(root, missionId, options = {}) {
  const { workspace, mission } = readCurrentMission(root, missionId, options.operation ?? "Research tree read");
  const relativePath = researchTreePath(mission.missionId);
  const context = currentMutationContext(root);
  const exists = context ? context.fileExists(relativePath) : fs.existsSync(path.resolve(root, relativePath));
  if (!exists) return null;
  return validateResearchTree(readJson(root, relativePath, null), {
    label: relativePath,
    workspaceId: workspace.manifest.workspaceId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest
  });
}

function mutationModeFor(root, args) {
  const explicit = Object.hasOwn(args, "mutationMode") ? normalizeMutationMode(args.mutationMode) : null;
  const active = currentMutationContext(root)?.mutationMode ?? null;
  if (active && explicit && active !== explicit) throw new Error(`reevaluate-research-tree mutationMode ${explicit} does not match the active mutation context mode ${active}.`);
  return active ?? explicit ?? "direct-process";
}

function createdAtFor(args) {
  if (args.confirmed !== true) return new Date().toISOString();
  return exactIso(args.createdAt, "createdAt");
}

function normalizedArgs(args) {
  if (args.operation !== "reevaluate-research-tree") throw new Error("Research-tree reevaluation requires operation reevaluate-research-tree.");
  if (!Array.isArray(args.nodeUpdates) || args.nodeUpdates.length === 0) throw new Error("reevaluate-research-tree requires at least one decision node update.");
  const nodeUpdates = args.nodeUpdates.map((node, index) => normalizeNode(node, `nodeUpdates[${index}]`, { allowUnassignedBlockedLesson: true }));
  if (new Set(nodeUpdates.map((node) => node.nodeId)).size !== nodeUpdates.length) throw new Error("nodeUpdates must not contain duplicate nodeId values.");
  return {
    operation: "reevaluate-research-tree",
    missionId: domainSafeId(args.missionId, "missionId"),
    requirement: domainNonEmptyText(args.requirement, "requirement"),
    nodeUpdates
  };
}

function validateCurrentEvidenceRefs(root, missionId, references, label) {
  return references.map((reference, index) => {
    if (reference.startsWith("source:")) {
      const sourceId = domainSafeId(reference.slice("source:".length), `${label}[${index}] source id`);
      const evaluation = evaluateSourceReferences(root, [sourceId], missionId)[0];
      if (!evaluation?.eligible) throw new Error(`${label}[${index}] is not current eligible source evidence: ${evaluation?.reason ?? "unknown-source"}.`);
      return { reference: `source:${sourceId}`, sourceId };
    }
    if (reference.startsWith("note:")) {
      const noteId = domainSafeId(reference.slice("note:".length), `${label}[${index}] note id`);
      const evaluation = evaluateNoteReferences(root, [noteId], missionId)[0];
      if (!evaluation?.eligible) throw new Error(`${label}[${index}] is not current eligible note evidence: ${evaluation?.reason ?? "unknown-note"}.`);
      return { reference: `note:${noteId}`, noteId };
    }
    if (reference.startsWith("validation:")) {
      const validation = resolveMissionValidationReference(root, missionId, reference.slice("validation:".length), `${label}[${index}]`);
      return { reference: `validation:${validation.reference}`, validation };
    }
    const rawPath = reference.startsWith("artifact:") ? reference.slice("artifact:".length) : reference;
    const [artifact] = resolveMissionArtifactReferences(root, missionId, [rawPath], `${label}[${index}]`);
    return { reference: `artifact:${artifact.path}`, artifact };
  });
}

function deterministicLessonId(missionId, revision, nodeId) {
  return `research-blocked-${domainSha256(`${missionId}\n${revision}\n${nodeId}`).slice(0, 24)}`;
}

function failureLesson(workspaceId, mission, treeRevision, node, evidence, createdAt) {
  const sourceIds = evidence.filter((item) => item.sourceId).map((item) => item.sourceId);
  const noteIds = evidence.filter((item) => item.noteId).map((item) => item.noteId);
  const artifactRefs = evidence.filter((item) => item.artifact).map((item) => ({ path: item.artifact.path, sha256: item.artifact.sha256 }));
  return {
    schemaVersion: 2,
    workspaceId,
    lessonId: node.lessonId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    scope: "mission",
    kind: "failure",
    researchTreeOrigin: { nodeId: node.nodeId, treeRevision, blockedReasonCode: node.blockedReasonCode },
    summary: `Research decision ${node.nodeId} was blocked: ${node.outcomeSummary}`,
    nextTimeGuidance: [`Reevaluate ${node.nodeId} only when the host presents a new user requirement or explicit direction.`],
    sourceIds,
    noteIds,
    artifactRefs,
    appliesToArtifactRefs: [],
    tags: ["research-tree", "blocked", node.blockedReasonCode],
    createdAt
  };
}

function buildProposal(root, args) {
  const input = normalizedArgs(args);
  const { workspace, mission } = readCurrentMission(root, input.missionId, "Research tree reevaluation");
  const mutationMode = mutationModeFor(root, args);
  if (args.confirmed === true) {
    if (args.workspaceId !== workspace.manifest.workspaceId) throw new Error("Confirmed research-tree replay no longer matches the workspace identity.");
    if (args.contractDigest !== mission.contractDigest) throw new Error("Confirmed research-tree replay no longer matches the mission contract digest.");
  }
  const currentTree = readResearchTree(root, mission.missionId, { operation: "Research tree reevaluation" });
  const currentNodes = currentTree?.nodes ?? [];
  const byId = new Map(currentNodes.map((node) => [node.nodeId, node]));
  const createdAt = createdAtFor(args);
  const fromRevision = currentTree?.revision ?? 0;
  const toRevision = fromRevision + 1;
  const addedNodes = [];
  const completedNodes = [];
  const blockedNodes = [];
  const unchangedNodes = [];
  const blockedEvidence = new Map();
  for (const update of input.nodeUpdates) {
    const existing = byId.get(update.nodeId);
    const assignedUpdate = update.status === "blocked"
      ? { ...update, lessonId: deterministicLessonId(mission.missionId, toRevision, update.nodeId) }
      : update;
    if (!existing) {
      if (assignedUpdate.status !== "pending") {
        throw new Error("New research-tree nodes must start as pending before they can become completed or blocked.");
      }
      const added = { ...assignedUpdate, createdAt, updatedAt: createdAt };
      addedNodes.push(added);
      byId.set(added.nodeId, added);
      continue;
    }
    if (!sameImmutableNodeFields(existing, assignedUpdate)) throw new Error(`Research tree node ${update.nodeId} may not change its parent or decision definition after persistence.`);
    if (existing.status !== "pending") {
      if (!sameOutcome(existing, assignedUpdate)) throw new Error(`Research tree node ${update.nodeId} is terminal and may not change after ${existing.status}.`);
      unchangedNodes.push(existing.nodeId);
      continue;
    }
    if (assignedUpdate.status === "pending") {
      unchangedNodes.push(existing.nodeId);
      continue;
    }
    const outcomeEvidence = validateCurrentEvidenceRefs(root, mission.missionId, assignedUpdate.outcomeEvidenceRefs, `nodeUpdates.${assignedUpdate.nodeId}.outcomeEvidenceRefs`);
    if (assignedUpdate.status === "blocked") {
      blockedEvidence.set(assignedUpdate.nodeId, outcomeEvidence);
    }
    const changed = { ...existing, ...assignedUpdate, createdAt: existing.createdAt, updatedAt: createdAt };
    byId.set(changed.nodeId, changed);
    if (changed.status === "completed") completedNodes.push(changed);
    else blockedNodes.push(changed);
  }
  if (blockedNodes.length > 0 && addedNodes.length > 0) throw new Error("A blocked research-tree reevaluation must not add alternative or replacement nodes in the same proposal.");
  if (addedNodes.length === 0 && completedNodes.length === 0 && blockedNodes.length === 0) throw new Error("Research-tree reevaluation produced no durable decision changes; no write proposal was created.");
  const nodes = [...byId.values()];
  assertTreeGraph(nodes);
  const tree = {
    schemaVersion: RESEARCH_TREE_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    revision: toRevision,
    nodes,
    updatedAt: createdAt
  };
  validateResearchTree(tree, { workspaceId: workspace.manifest.workspaceId, missionId: mission.missionId, contractDigest: mission.contractDigest });
  const lessons = blockedNodes.map((node) => failureLesson(workspace.manifest.workspaceId, mission, toRevision, node, blockedEvidence.get(node.nodeId) ?? [], createdAt));
  const receiptId = args.confirmed === true ? domainSafeId(args.receiptId, "receiptId") : `receipt-create-dove-mission-${crypto.randomUUID()}`;
  const diff = {
    fromRevision,
    toRevision,
    addedNodes: addedNodes.map((node) => node.nodeId),
    completedNodes: completedNodes.map((node) => node.nodeId),
    blockedNodes: blockedNodes.map((node) => node.nodeId),
    unchangedNodes
  };
  const proposalWorkspace = canonicalWorkspacePath(root);
  const envelope = {
    proposalVersion: RESEARCH_TREE_PROPOSAL_VERSION,
    proposalWorkspace,
    workspaceId: workspace.manifest.workspaceId,
    mutationMode,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    requirement: input.requirement,
    currentTreeDigest: currentTree ? domainSha256(stableWorkspaceSerialize(currentTree)) : null,
    tree,
    diff,
    lessons,
    receiptId
  };
  const proposalDigest = domainSha256(stableWorkspaceSerialize(envelope));
  return { input, mission, tree, diff, lessons, receiptId, envelope, proposalDigest, mutationMode, relativePath: researchTreePath(mission.missionId) };
}

function confirmArgsFor(proposal) {
  return {
    operation: proposal.input.operation,
    confirmed: true,
    proposalVersion: RESEARCH_TREE_PROPOSAL_VERSION,
    proposalWorkspace: proposal.envelope.proposalWorkspace,
    proposalDigest: proposal.proposalDigest,
    mutationMode: proposal.mutationMode,
    workspaceId: proposal.envelope.workspaceId,
    contractDigest: proposal.envelope.contractDigest,
    createdAt: proposal.tree.updatedAt,
    receiptId: proposal.receiptId,
    missionId: proposal.input.missionId,
    requirement: proposal.input.requirement,
    nodeUpdates: proposal.input.nodeUpdates
  };
}

function withToken(proposal) {
  const confirmArgs = confirmArgsFor(proposal);
  const proposalToken = Buffer.from(JSON.stringify({ version: RESEARCH_TREE_PROPOSAL_VERSION, mutationMode: proposal.mutationMode, confirmArgs }), "utf8").toString("base64url");
  return { ...proposal, proposalToken };
}

function assertExactReplay(root, proposal, args) {
  if (!currentMutationContext(root)) throw new Error("Confirmed research-tree reevaluation requires an active MutationContext.");
  if (args.proposalVersion !== RESEARCH_TREE_PROPOSAL_VERSION) throw new Error("The selected research-tree proposal version is unsupported. Request a fresh proposal.");
  const expected = confirmArgsFor(proposal);
  const supplied = Object.fromEntries(Object.entries(args).filter(([field]) => REEVALUATE_FIELDS.has(field) || REPLAY_FIELDS.has(field)));
  if (stableWorkspaceSerialize(supplied) !== stableWorkspaceSerialize(expected)) throw new Error("The selected research-tree proposal no longer matches the exact diff, current tree, workspace, mission contract, evidence, receipt, or mutation mode. Request a fresh proposal.");
}

export function reevaluateResearchTree(root, args = {}) {
  assertSealedDomainArgs(args, new Set([...REEVALUATE_FIELDS, ...REPLAY_FIELDS]), "create_dove_mission reevaluate-research-tree");
  if (args.confirmed !== true) {
    const replayOnly = Object.keys(args).filter((field) => REPLAY_FIELDS.has(field) && field !== "mutationMode");
    if (replayOnly.length > 0) throw new Error(`reevaluate-research-tree proposal does not accept caller replay fields: ${replayOnly.map((field) => `$.${field}`).join(", ")}.`);
  }
  const proposal = withToken(buildProposal(root, args));
  if (args.confirmed !== true) {
    return {
      status: "needs-confirmation",
      operation: "reevaluate-research-tree",
      missionId: proposal.mission.missionId,
      requirement: proposal.input.requirement,
      hostMediation: "The host invokes reevaluation when a new user requirement or explicit direction is available; Dove does not schedule, poll, or continue research autonomously.",
      tree: proposal.tree,
      diff: proposal.diff,
      lessons: proposal.lessons,
      proposalDigest: proposal.proposalDigest,
      approval: {
        required: true,
        noChangesApplied: true,
        summary: `Dove can save the proposed research decision changes for: ${proposal.input.requirement}`,
        effects: [
          ...(proposal.diff.addedNodes.length > 0
            ? [`Add ${proposal.diff.addedNodes.length} research decision${proposal.diff.addedNodes.length === 1 ? "" : "s"}.`]
            : []),
          ...(proposal.diff.completedNodes.length > 0
            ? [`Mark ${proposal.diff.completedNodes.length} research decision${proposal.diff.completedNodes.length === 1 ? "" : "s"} completed.`]
            : []),
          ...(proposal.diff.blockedNodes.length > 0
            ? [`Mark ${proposal.diff.blockedNodes.length} research decision${proposal.diff.blockedNodes.length === 1 ? "" : "s"} blocked and preserve the resulting lesson${proposal.diff.blockedNodes.length === 1 ? "" : "s"}.`]
            : [])
        ],
        question: "Save these research decision changes and continue the requested work?"
      },
      confirmation: {
        required: true,
        exactReplay: true,
        proposalVersion: RESEARCH_TREE_PROPOSAL_VERSION,
        proposalWorkspace: proposal.envelope.proposalWorkspace,
        proposalDigest: proposal.proposalDigest,
        proposalToken: proposal.proposalToken,
        mutationMode: proposal.mutationMode,
        confirmArgs: confirmArgsFor(proposal)
      },
      mutation: { mutationMode: proposal.mutationMode, writesApplied: false, paths: [] }
    };
  }
  assertExactReplay(root, proposal, args);
  const writes = [{
    path: proposal.relativePath,
    kind: "data",
    content: domainJson(proposal.tree),
    derivedReferences: [`mission:${proposal.mission.missionId}`, `research-tree-revision:${proposal.tree.revision}`]
  }, ...proposal.lessons.map((lesson) => ({
    path: path.posix.join(ARTIFACT_PATHS.lessonsDir, `${lesson.lessonId}.json`),
    kind: "data",
    content: domainJson(lesson),
    derivedReferences: [`research-tree:${proposal.mission.missionId}`, `research-node:${lesson.researchTreeOrigin.nodeId}`]
  }))];
  const recorded = finalizeDomainArtifacts(root, {
    actionId: "create-dove-mission",
    operation: "Research tree reevaluation",
    missionId: proposal.mission.missionId,
    receiptId: proposal.receiptId,
    summary: `Recorded research tree revision ${proposal.tree.revision} for mission ${proposal.mission.missionId}.`,
    allowResearchTreeArtifacts: true,
    writes
  });
  return {
    ...recorded,
    operation: "reevaluate-research-tree",
    requirement: proposal.input.requirement,
    hostMediation: "The host invokes reevaluation for new user requirements; this transaction does not start a daemon, scheduler, poller, or autonomous continuation.",
    tree: proposal.tree,
    diff: proposal.diff,
    lessons: proposal.lessons
  };
}

export function researchTreeProjection(tree, detail = "compact") {
  if (!tree) return null;
  const statusCounts = Object.fromEntries(RESEARCH_TREE_NODE_STATUSES.map((status) => [status, tree.nodes.filter((node) => node.status === status).length]));
  const summary = { missionId: tree.missionId, revision: tree.revision, nodeCount: tree.nodes.length, statusCounts, updatedAt: tree.updatedAt };
  return detail === "full" ? { ...summary, nodes: tree.nodes } : summary;
}
