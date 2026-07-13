import { analyzeArtifactConsistency, readTaskPacketCatalog } from "./task-packets.mjs";
import { ARTIFACT_PATHS } from "./schema.mjs";
import { inspectDeclaredPath, isExternalArtifactReference, normalizeProjectRelativePath } from "./artifact-integrity.mjs";
import { readJson } from "./workspace.mjs";

function normalizeStrings(value) {
  const values = Array.isArray(value) ? value : (typeof value === "string" ? [value] : []);
  return Array.from(new Set(values.map((item) => String(item).trim()).filter(Boolean)));
}

function localPaths(values = []) {
  return normalizeStrings(values)
    .filter((item) => !isExternalArtifactReference(item))
    .map((item) => normalizeProjectRelativePath(item))
    .filter((item) => item.ok)
    .map((item) => item.normalizedPath);
}

function packetPaths(packet = {}) {
  const context = packet.context && typeof packet.context === "object" ? packet.context : {};
  const criteria = [packet.verifiedCriteria, context.verifiedCriteria].flat().filter(Boolean);
  const scopedRecords = [packet.scopedRecords, context.scopedRecords].flat().filter(Boolean);
  return localPaths([
    packet.packetPath,
    packet.packetContextPath,
    ...normalizeStrings(packet.artifactRefs),
    ...normalizeStrings(context.artifactRefs),
    ...normalizeStrings(packet.outputPaths),
    ...normalizeStrings(context.outputPaths),
    ...normalizeStrings(packet.evidenceLinks),
    ...normalizeStrings(context.evidenceLinks),
    ...normalizeStrings(packet.validationEvidencePaths),
    ...normalizeStrings(context.validationEvidencePaths),
    ...normalizeStrings(packet.verificationEvidencePaths),
    ...normalizeStrings(context.verificationEvidencePaths),
    ...criteria.flatMap((criterion) => normalizeStrings(criterion?.evidencePaths)),
    ...scopedRecords.flatMap((record) => normalizeStrings(record?.paths ?? record?.artifactPaths ?? record?.evidencePaths))
  ]);
}

function descendantsOf(packet, packets) {
  const included = new Map([[packet.id, packet]]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of packets) {
      if (!included.has(candidate.id) && candidate.parentId && included.has(candidate.parentId)) {
        included.set(candidate.id, candidate);
        changed = true;
      }
    }
  }
  return Array.from(included.values());
}

function entityIds(packets, field) {
  return Array.from(new Set(packets.flatMap((packet) => normalizeStrings(packet[field]))));
}

function packetBoundRecordIds(root, includedPacketIds, relativePath, collectionField, idField = "id") {
  const included = new Set(includedPacketIds);
  const collection = readJson(root, relativePath, { [collectionField]: [] });
  return Array.from(new Set((collection?.[collectionField] ?? [])
    .filter((item) => normalizeStrings(item?.packetIds ?? item?.packetId).some((packetId) => included.has(packetId)))
    .map((item) => item?.[idField])
    .filter(Boolean)));
}

function packetBoundRecordPaths(root, includedPacketIds) {
  const included = new Set(includedPacketIds);
  const evidence = readJson(root, ARTIFACT_PATHS.evidence, { claims: [] });
  const paths = [];
  const scopedClaims = (evidence.claims ?? []).filter((claim) => normalizeStrings(claim.packetIds ?? claim.packetId).some((packetId) => included.has(packetId)));
  if (scopedClaims.length > 0) {
    paths.push(ARTIFACT_PATHS.evidence, ARTIFACT_PATHS.claims);
    for (const claim of scopedClaims) {
      if (claim.sectionId) paths.push(`${ARTIFACT_PATHS.draftsDir}/${claim.sectionId}.md`);
    }
  }
  const figures = readJson(root, ARTIFACT_PATHS.figuresIndex, { items: [] });
  const scopedFigures = (figures.items ?? []).filter((item) => normalizeStrings(item.packetIds ?? item.packetId).some((packetId) => included.has(packetId)));
  if (scopedFigures.length > 0) {
    paths.push(ARTIFACT_PATHS.figuresIndex, ARTIFACT_PATHS.figureEditableIndex);
    for (const figure of scopedFigures) paths.push(...localPaths([figure.templateSvgPath, figure.finalSvgPath, figure.sourceSvgPath]));
  }
  return Array.from(new Set(paths));
}

function scopeError(message, details = {}) {
  const error = new Error(message);
  error.code = "REVIEW_SCOPE_INVALID";
  Object.assign(error, details);
  return error;
}

export function buildReviewScope(root, target, options = {}) {
  const catalog = options.catalog ?? readTaskPacketCatalog(root);
  const packet = catalog.byId.get(target?.packetId) ?? target?.packet;
  if (!packet?.id) {
    throw scopeError("Review scope requires a resolved durable task packet.");
  }
  const includedPackets = descendantsOf(packet, catalog.packets);
  const includedPacketIds = includedPackets.map((item) => item.id);
  const defaultPaths = Array.from(new Set([
    ...includedPackets.flatMap(packetPaths),
    ...packetBoundRecordPaths(root, includedPacketIds)
  ]));
  const explicitPaths = localPaths([
    ...normalizeStrings(options.reviewedArtifactPaths),
    ...normalizeStrings(options.artifactPaths)
  ]);

  if (explicitPaths.length > 0) {
    const consistency = analyzeArtifactConsistency(packet, catalog.packets, explicitPaths);
    if (consistency.hasConflict) {
      const owners = consistency.conflictingMatches.map((item) => `${item.packetId}(${item.relation})`).join(", ");
      throw scopeError(`Reviewed artifact paths conflict with packet ${packet.id}: ${owners}.`, { artifactResolution: consistency });
    }
    const allowed = new Set(defaultPaths);
    const invalid = explicitPaths.filter((item) => !allowed.has(item));
    if (invalid.length > 0) {
      throw scopeError(`Reviewed artifact paths must be owned by packet ${packet.id} or its descendants: ${invalid.join(", ")}.`);
    }
  }

  const reviewedArtifactPaths = Array.from(new Set(explicitPaths.length > 0 ? explicitPaths : defaultPaths));
  const inspections = reviewedArtifactPaths.map((artifactPath) => inspectDeclaredPath(root, artifactPath, {
    requireNonEmpty: true,
    rejectBookkeeping: true,
    requireSemanticEvidence: true
  }));
  const substantiveArtifactPaths = inspections
    .filter((item) => item.status === "existing")
    .map((item) => item.canonicalRelativePath ?? item.normalizedPath);

  return {
    packetId: packet.id,
    packet,
    includedPacketIds,
    includedPackets,
    claimIds: Array.from(new Set([...entityIds(includedPackets, "claimIds"), ...packetBoundRecordIds(root, includedPacketIds, ARTIFACT_PATHS.evidence, "claims")])),
    noteIds: Array.from(new Set([...entityIds(includedPackets, "noteIds"), ...packetBoundRecordIds(root, includedPacketIds, ARTIFACT_PATHS.notes, "items")])),
    experimentIds: Array.from(new Set([...entityIds(includedPackets, "experimentIds"), ...packetBoundRecordIds(root, includedPacketIds, ARTIFACT_PATHS.experimentPlans, "items")])),
    figureIds: packetBoundRecordIds(root, includedPacketIds, ARTIFACT_PATHS.figuresIndex, "items"),
    resultIds: Array.from(new Set([...entityIds(includedPackets, "resultIds"), ...packetBoundRecordIds(root, includedPacketIds, ARTIFACT_PATHS.experimentResults, "items")])),
    auditIds: Array.from(new Set([...entityIds(includedPackets, "auditIds"), ...packetBoundRecordIds(root, includedPacketIds, ARTIFACT_PATHS.experimentAudits, "items")])),
    rebuttalIssueIds: entityIds(includedPackets, "rebuttalIssueIds"),
    versionIds: entityIds(includedPackets, "versionIds"),
    reviewedArtifactPaths,
    substantiveArtifactPaths,
    artifactInspections: inspections,
    hasReviewMaterials: substantiveArtifactPaths.length > 0
  };
}

export function assertReviewMaterials(scope, label = "review") {
  if (!scope?.hasReviewMaterials) {
    const details = (scope?.artifactInspections ?? [])
      .map((item) => `${item.normalizedPath ?? item.path}:${item.reason ?? item.status}`)
      .join(", ") || "no packet-owned artifact paths";
    throw scopeError(`${label} requires at least one existing non-empty non-bookkeeping substantive artifact in packet scope (${details}).`, {
      boundaryType: "missing-review-materials",
      packetId: scope?.packetId ?? null
    });
  }
  return scope;
}
