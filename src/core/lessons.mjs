import fs from "node:fs";
import path from "node:path";

import { inspectDeclaredPath } from "./artifact-integrity.mjs";
import { readArtifactOwnership } from "./artifact-lineage.mjs";
import {
  assertSealedDomainArgs,
  domainJson,
  domainNonEmptyText,
  domainSafeId,
  domainSha256,
  domainStringArray,
  finalizeDomainArtifacts,
  readCurrentMission,
  resolveMissionArtifactReferences
} from "./domain-artifacts.mjs";
import { currentMutationContext, normalizeMutationMode } from "./mutation-backend.mjs";
import { sha256File } from "./review-artifact-snapshot.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import { evaluateNoteReferences, evaluateSourceReferences } from "./source-trust.mjs";
import { nowIso, readJson } from "./workspace.mjs";
import { canonicalWorkspacePath, openDoveWorkspace, stableWorkspaceSerialize } from "./workspace-schema.mjs";

export const DOVE_LESSON_SCHEMA_VERSION = 1;
export const DOVE_LESSON_PROPOSAL_VERSION = 1;
export const DOVE_LESSON_SCOPES = Object.freeze(["global", "mission"]);
export const DOVE_LESSON_KINDS = Object.freeze(["preference", "constraint", "method", "failure", "review-insight"]);

const LESSON_SCOPE_SET = new Set(DOVE_LESSON_SCOPES);
const LESSON_KIND_SET = new Set(DOVE_LESSON_KINDS);
const RECORD_FIELDS = new Set([
  "missionId",
  "lessonId",
  "scope",
  "kind",
  "summary",
  "details",
  "nextTimeGuidance",
  "sourceIds",
  "noteIds",
  "artifactRefs",
  "appliesToArtifactRefs",
  "tags",
  "supersedesLessonId"
]);
const REPLAY_FIELDS = new Set([
  "confirmed",
  "proposalVersion",
  "proposalWorkspace",
  "proposalDigest",
  "proposalToken",
  "mutationMode",
  "workspaceId",
  "contractDigest",
  "createdAt"
]);
const QUERY_FIELDS = new Set([
  "lessonId",
  "missionId",
  "scope",
  "kind",
  "tags",
  "artifactRefs",
  "includeSuperseded",
  "includeUnscoped",
  "limit"
]);

function lessonPath(lessonId) {
  return path.posix.join(ARTIFACT_PATHS.lessonsDir, `${lessonId}.json`);
}

function normalizeOptionalText(value, label) {
  if (value === undefined) return undefined;
  return domainNonEmptyText(value, label);
}

function normalizeEnum(value, allowed, label) {
  const normalized = domainNonEmptyText(value, label).toLowerCase();
  if (!allowed.has(normalized)) throw new Error(`${label} must be one of: ${[...allowed].join(", ")}.`);
  return normalized;
}

function normalizeMutationModeForLesson(root, args) {
  const explicit = Object.hasOwn(args, "mutationMode") ? normalizeMutationMode(args.mutationMode) : null;
  const active = currentMutationContext(root)?.mutationMode ?? null;
  if (active && explicit && active !== explicit) {
    throw new Error(`record_dove_lesson mutationMode ${explicit} does not match the active mutation context mode ${active}.`);
  }
  return active ?? explicit ?? "direct-process";
}

function readLessons(root) {
  openDoveWorkspace(root, { operation: "Dove lesson read" });
  const directory = path.resolve(root, ARTIFACT_PATHS.lessonsDir);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => readJson(root, path.posix.join(ARTIFACT_PATHS.lessonsDir, entry.name), null));
}

function validateEligibleReferences(root, missionId, sourceIds, noteIds) {
  const sources = evaluateSourceReferences(root, sourceIds, missionId);
  const sourceFailure = sources.find((item) => item.eligible !== true);
  if (sourceFailure) throw new Error(`sourceIds contains ineligible current source ${sourceFailure.reference}: ${sourceFailure.reason}.`);
  const notes = evaluateNoteReferences(root, noteIds, missionId);
  const noteFailure = notes.find((item) => item.eligible !== true);
  if (noteFailure) throw new Error(`noteIds contains ineligible current note ${noteFailure.reference}: ${noteFailure.reason}.`);
  return {
    sources: sources.map((item) => ({ reference: item.reference, snapshotDigest: domainSha256(stableWorkspaceSerialize(item.source)) })),
    notes: notes.map((item) => ({ reference: item.reference, snapshotDigest: domainSha256(stableWorkspaceSerialize(item.note)) }))
  };
}

function referenceSnapshots(references) {
  return references.map((reference) => ({ path: reference.path, sha256: reference.sha256 }));
}

function assertSupersession(lessons, candidate) {
  if (!candidate.supersedesLessonId) return null;
  if (candidate.supersedesLessonId === candidate.lessonId) throw new Error("A Dove lesson must not supersede itself.");
  const previous = lessons.find((lesson) => lesson.lessonId === candidate.supersedesLessonId);
  if (!previous) throw new Error(`Cannot supersede unknown lesson ${candidate.supersedesLessonId}.`);
  if (previous.scope !== candidate.scope || previous.kind !== candidate.kind) {
    throw new Error("A Dove lesson may supersede only a lesson with the same scope and kind.");
  }
  if (candidate.scope === "mission" && previous.missionId !== candidate.missionId) {
    throw new Error("A mission-scoped Dove lesson may supersede only a lesson from the same mission.");
  }
  const successor = lessons.find((lesson) => lesson.supersedesLessonId === previous.lessonId);
  if (successor) throw new Error(`Lesson ${previous.lessonId} already has successor ${successor.lessonId}; supersession must not fork.`);
  const seen = new Set([candidate.lessonId]);
  let cursor = previous;
  while (cursor) {
    if (seen.has(cursor.lessonId)) throw new Error("Dove lesson supersession must not contain a cycle.");
    seen.add(cursor.lessonId);
    cursor = cursor.supersedesLessonId ? lessons.find((lesson) => lesson.lessonId === cursor.supersedesLessonId) : null;
  }
  return { lessonId: previous.lessonId, createdAt: previous.createdAt };
}

function normalizedRecordInput(args) {
  const content = {
    lessonId: domainSafeId(args.lessonId, "lessonId"),
    missionId: domainSafeId(args.missionId, "missionId"),
    scope: normalizeEnum(args.scope, LESSON_SCOPE_SET, "scope"),
    kind: normalizeEnum(args.kind, LESSON_KIND_SET, "kind"),
    summary: domainNonEmptyText(args.summary, "summary"),
    nextTimeGuidance: domainStringArray(args.nextTimeGuidance, "nextTimeGuidance", { minItems: 1 }),
    sourceIds: domainStringArray(args.sourceIds, "sourceIds"),
    noteIds: domainStringArray(args.noteIds, "noteIds"),
    artifactRefs: domainStringArray(args.artifactRefs, "artifactRefs"),
    appliesToArtifactRefs: domainStringArray(args.appliesToArtifactRefs, "appliesToArtifactRefs"),
    tags: domainStringArray(args.tags, "tags")
  };
  const details = normalizeOptionalText(args.details, "details");
  if (details !== undefined) content.details = details;
  if (args.supersedesLessonId !== undefined) content.supersedesLessonId = domainSafeId(args.supersedesLessonId, "supersedesLessonId");
  return content;
}

function createdAtFor(args) {
  if (args.confirmed !== true) return nowIso();
  const createdAt = domainNonEmptyText(args.createdAt, "createdAt");
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== createdAt) {
    throw new Error("createdAt replay data must be an exact ISO-8601 timestamp.");
  }
  return createdAt;
}

function buildProposal(root, args) {
  const content = normalizedRecordInput(args);
  const { workspace, mission } = readCurrentMission(root, content.missionId, "Dove lesson proposal");
  const mutationMode = normalizeMutationModeForLesson(root, args);
  if (args.confirmed === true) {
    if (args.workspaceId !== workspace.manifest.workspaceId) throw new Error("Confirmed Dove lesson replay no longer matches the workspace identity.");
    if (args.contractDigest !== mission.contractDigest) throw new Error("Confirmed Dove lesson replay no longer matches the mission contract digest.");
  }
  const relativePath = lessonPath(content.lessonId);
  const context = currentMutationContext(root);
  const occupied = context ? context.fileExists(relativePath) : fs.existsSync(path.resolve(root, relativePath));
  if (occupied) throw new Error(`Dove lesson id is already occupied: ${content.lessonId}.`);
  const lessons = readLessons(root);
  const evidenceSnapshots = validateEligibleReferences(root, mission.missionId, content.sourceIds, content.noteIds);
  const artifacts = resolveMissionArtifactReferences(root, mission.missionId, content.artifactRefs, "artifactRefs");
  const applicability = resolveMissionArtifactReferences(root, mission.missionId, content.appliesToArtifactRefs, "appliesToArtifactRefs");
  const supersession = assertSupersession(lessons, content);
  const createdAt = createdAtFor(args);
  const lesson = {
    schemaVersion: DOVE_LESSON_SCHEMA_VERSION,
    workspaceId: workspace.manifest.workspaceId,
    lessonId: content.lessonId,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    scope: content.scope,
    kind: content.kind,
    summary: content.summary,
    ...(content.details === undefined ? {} : { details: content.details }),
    nextTimeGuidance: content.nextTimeGuidance,
    sourceIds: content.sourceIds,
    noteIds: content.noteIds,
    artifactRefs: referenceSnapshots(artifacts),
    appliesToArtifactRefs: referenceSnapshots(applicability),
    tags: content.tags,
    ...(content.supersedesLessonId === undefined ? {} : { supersedesLessonId: content.supersedesLessonId }),
    createdAt
  };
  const proposalWorkspace = canonicalWorkspacePath(root);
  const envelope = {
    proposalVersion: DOVE_LESSON_PROPOSAL_VERSION,
    proposalWorkspace,
    workspaceId: workspace.manifest.workspaceId,
    mutationMode,
    missionId: mission.missionId,
    contractDigest: mission.contractDigest,
    lesson,
    evidenceSnapshots,
    supersession
  };
  const proposalDigest = domainSha256(stableWorkspaceSerialize(envelope));
  const proposalToken = Buffer.from(JSON.stringify({
    version: DOVE_LESSON_PROPOSAL_VERSION,
    proposalWorkspace,
    proposalDigest,
    lessonId: lesson.lessonId
  }), "utf8").toString("base64url");
  return { content, lesson, envelope, proposalDigest, proposalToken, relativePath, mutationMode };
}

function confirmArgsFor(proposal) {
  return {
    confirmed: true,
    proposalVersion: DOVE_LESSON_PROPOSAL_VERSION,
    proposalWorkspace: proposal.envelope.proposalWorkspace,
    proposalDigest: proposal.proposalDigest,
    proposalToken: proposal.proposalToken,
    mutationMode: proposal.mutationMode,
    workspaceId: proposal.envelope.workspaceId,
    contractDigest: proposal.envelope.contractDigest,
    createdAt: proposal.lesson.createdAt,
    missionId: proposal.content.missionId,
    lessonId: proposal.content.lessonId,
    scope: proposal.content.scope,
    kind: proposal.content.kind,
    summary: proposal.content.summary,
    ...(proposal.content.details === undefined ? {} : { details: proposal.content.details }),
    nextTimeGuidance: proposal.content.nextTimeGuidance,
    sourceIds: proposal.content.sourceIds,
    noteIds: proposal.content.noteIds,
    artifactRefs: proposal.content.artifactRefs,
    appliesToArtifactRefs: proposal.content.appliesToArtifactRefs,
    tags: proposal.content.tags,
    ...(proposal.content.supersedesLessonId === undefined ? {} : { supersedesLessonId: proposal.content.supersedesLessonId })
  };
}

function assertExactReplay(root, proposal, args) {
  if (!currentMutationContext(root)) throw new Error("Confirmed Dove lesson recording requires an active MutationContext.");
  if (args.proposalVersion !== DOVE_LESSON_PROPOSAL_VERSION) throw new Error("The selected Dove lesson proposal version is unsupported. Request a fresh proposal.");
  const expected = confirmArgsFor(proposal);
  const supplied = Object.fromEntries(Object.entries(args).filter(([field]) => REPLAY_FIELDS.has(field) || RECORD_FIELDS.has(field)));
  if (stableWorkspaceSerialize(supplied) !== stableWorkspaceSerialize(expected)) {
    throw new Error("The selected Dove lesson proposal no longer matches the exact replay fields, workspace, contract, mutation mode, supersession, or references. Request a fresh proposal.");
  }
}

function mutationMetadata(proposal, writesApplied, paths = []) {
  return { mutationMode: proposal.mutationMode, writesApplied, paths };
}

export function recordDoveLesson(root, args = {}) {
  assertSealedDomainArgs(args, new Set([...RECORD_FIELDS, ...REPLAY_FIELDS]), "record_dove_lesson");
  if (args.confirmed !== true) {
    const replayOnly = Object.keys(args).filter((field) => REPLAY_FIELDS.has(field) && field !== "mutationMode");
    if (replayOnly.length > 0) {
      throw new Error(`record_dove_lesson proposal does not accept caller replay fields: ${replayOnly.map((field) => `$.${field}`).join(", ")}.`);
    }
  }
  const proposal = buildProposal(root, args);
  if (args.confirmed !== true) {
    const confirmArgs = confirmArgsFor(proposal);
    return {
      status: "needs-confirmation",
      lesson: proposal.lesson,
      proposalDigest: proposal.proposalDigest,
      confirmation: {
        required: true,
        exactReplay: true,
        proposalVersion: DOVE_LESSON_PROPOSAL_VERSION,
        proposalWorkspace: proposal.envelope.proposalWorkspace,
        proposalDigest: proposal.proposalDigest,
        proposalToken: proposal.proposalToken,
        mutationMode: proposal.mutationMode,
        confirmArgs
      },
      advisoryOnly: true,
      authority: false,
      completionEligible: false,
      mutation: mutationMetadata(proposal, false)
    };
  }
  assertExactReplay(root, proposal, args);
  const derivedReferences = [
    ...proposal.lesson.sourceIds.map((id) => `source:${id}`),
    ...proposal.lesson.noteIds.map((id) => `note:${id}`),
    ...proposal.lesson.artifactRefs.map((item) => `artifact:${item.path}`),
    ...proposal.lesson.appliesToArtifactRefs.map((item) => `applies-to:${item.path}`),
    ...(proposal.lesson.supersedesLessonId ? [`lesson:${proposal.lesson.supersedesLessonId}`] : [])
  ];
  const recorded = finalizeDomainArtifacts(root, {
    actionId: "record-dove-lesson",
    operation: "Dove lesson recording",
    missionId: proposal.lesson.missionId,
    summary: `Recorded advisory lesson ${proposal.lesson.lessonId}.`,
    allowLessonArtifacts: true,
    writes: [{
      path: proposal.relativePath,
      kind: "data",
      content: domainJson(proposal.lesson),
      derivedReferences
    }]
  });
  return {
    ...recorded,
    lesson: proposal.lesson,
    advisoryOnly: true,
    authority: false,
    completionEligible: false
  };
}

function assessPinnedArtifacts(root, missionId, references) {
  const ownership = readArtifactOwnership(root);
  const byPath = new Map(ownership.artifacts.map((item) => [item.path, item]));
  return references.map((reference) => {
    const owner = byPath.get(reference.path);
    if (!owner) return { ...reference, current: false, reason: "artifact-ownership-missing" };
    const inspection = inspectDeclaredPath(root, reference.path, { requireNonEmpty: true });
    if (inspection.status !== "existing") return { ...reference, current: false, reason: inspection.reason ?? inspection.status };
    const currentHash = sha256File(path.resolve(root, reference.path));
    const current = currentHash === reference.sha256 && owner.sha256 === reference.sha256 && owner.missionId === missionId;
    return { ...reference, current, reason: current ? null : "artifact-hash-or-ownership-drift", actualHash: currentHash };
  });
}

function lessonAssessment(root, lesson, successorId, matchedArtifactRefs) {
  const sources = evaluateSourceReferences(root, lesson.sourceIds, lesson.missionId).map((item) => ({ reference: item.reference, current: item.eligible === true, reason: item.reason }));
  const notes = evaluateNoteReferences(root, lesson.noteIds, lesson.missionId).map((item) => ({ reference: item.reference, current: item.eligible === true, reason: item.reason }));
  const artifacts = assessPinnedArtifacts(root, lesson.missionId, lesson.artifactRefs);
  const applicability = assessPinnedArtifacts(root, lesson.missionId, lesson.appliesToArtifactRefs);
  const current = [...sources, ...notes, ...artifacts, ...applicability].every((item) => item.current === true);
  return {
    current,
    superseded: Boolean(successorId),
    successorLessonId: successorId ?? null,
    evidence: { sources, notes, artifacts },
    applicability,
    matchedArtifactRefs
  };
}

export function queryDoveLessons(root, args = {}) {
  assertSealedDomainArgs(args, QUERY_FIELDS, "query_dove_lessons");
  const workspace = openDoveWorkspace(root, { operation: "Dove lesson query" });
  const lessonId = args.lessonId === undefined ? null : domainSafeId(args.lessonId, "lessonId");
  const missionId = args.missionId === undefined ? null : domainSafeId(args.missionId, "missionId");
  const scope = args.scope === undefined ? null : normalizeEnum(args.scope, LESSON_SCOPE_SET, "scope");
  const kind = args.kind === undefined ? null : normalizeEnum(args.kind, LESSON_KIND_SET, "kind");
  const tags = domainStringArray(args.tags, "tags");
  const artifactRefs = domainStringArray(args.artifactRefs, "artifactRefs");
  if (artifactRefs.length > 0 && !missionId) throw new Error("Artifact-scoped Dove lesson queries require missionId.");
  if (missionId) readCurrentMission(root, missionId, "Dove lesson query");
  const queryArtifacts = artifactRefs.length > 0 ? resolveMissionArtifactReferences(root, missionId, artifactRefs, "artifactRefs") : [];
  const queryArtifactPaths = new Set(queryArtifacts.map((item) => item.path));
  const includeSuperseded = args.includeSuperseded === true;
  const includeUnscoped = args.includeUnscoped === true;
  const limitNumber = args.limit === undefined ? 50 : Number(args.limit);
  if (!Number.isInteger(limitNumber) || limitNumber < 1 || limitNumber > 200) throw new Error("limit must be an integer from 1 to 200.");
  const lessons = readLessons(root);
  const successorByLesson = new Map(lessons.filter((lesson) => lesson.supersedesLessonId).map((lesson) => [lesson.supersedesLessonId, lesson.lessonId]));
  const items = lessons
    .filter((lesson) => !lessonId || lesson.lessonId === lessonId)
    .filter((lesson) => missionId ? lesson.scope === "global" || (lesson.scope === "mission" && lesson.missionId === missionId) : lesson.scope === "global")
    .filter((lesson) => !scope || lesson.scope === scope)
    .filter((lesson) => !kind || lesson.kind === kind)
    .filter((lesson) => tags.every((tag) => lesson.tags.includes(tag)))
    .filter((lesson) => includeSuperseded || !successorByLesson.has(lesson.lessonId))
    .map((lesson) => {
      const matchedArtifactRefs = lesson.appliesToArtifactRefs.map((item) => item.path).filter((item) => queryArtifactPaths.has(item));
      return { lesson, matchedArtifactRefs };
    })
    .filter(({ lesson, matchedArtifactRefs }) => queryArtifactPaths.size === 0 || matchedArtifactRefs.length > 0 || (includeUnscoped && lesson.appliesToArtifactRefs.length === 0))
    .map(({ lesson, matchedArtifactRefs }) => ({
      lessonId: lesson.lessonId,
      missionId: lesson.missionId,
      contractDigest: lesson.contractDigest,
      scope: lesson.scope,
      kind: lesson.kind,
      summary: lesson.summary,
      ...(lesson.details === undefined ? {} : { details: lesson.details }),
      nextTimeGuidance: lesson.nextTimeGuidance,
      sourceIds: lesson.sourceIds,
      noteIds: lesson.noteIds,
      artifactRefs: lesson.artifactRefs,
      appliesToArtifactRefs: lesson.appliesToArtifactRefs,
      tags: lesson.tags,
      ...(lesson.supersedesLessonId === undefined ? {} : { supersedesLessonId: lesson.supersedesLessonId }),
      createdAt: lesson.createdAt,
      assessment: lessonAssessment(root, lesson, successorByLesson.get(lesson.lessonId), matchedArtifactRefs)
    }))
    .sort((left, right) => (
      right.assessment.matchedArtifactRefs.length - left.assessment.matchedArtifactRefs.length
      || Number(right.scope === "mission") - Number(left.scope === "mission")
      || String(right.createdAt).localeCompare(String(left.createdAt))
      || left.lessonId.localeCompare(right.lessonId)
    ))
    .slice(0, limitNumber);
  return {
    status: items.length > 0 ? "ok" : "empty",
    workspaceId: workspace.manifest.workspaceId,
    missionId,
    lessonCount: items.length,
    items,
    advisoryOnly: true,
    authority: false,
    writes: []
  };
}
