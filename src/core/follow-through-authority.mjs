import crypto from "node:crypto";

function normalizeStringArray(value) {
  return Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .map((item) => String(item).trim())
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right))
    : [];
}

function normalizeAuthorityItems(value, project) {
  return Array.isArray(value)
    ? value
        .map(project)
        .sort((left, right) =>
          stableJson(left).localeCompare(stableJson(right))
        )
    : [];
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function conversionPathAuthority(value) {
  return normalizeAuthorityItems(
    value,
    (item) => ({
      targetType: item.targetType ?? null,
      targetId: item.targetId ?? null,
      assignedRole: item.assignedRole ?? null,
      priority: item.priority ?? null,
      suggestedTitle: item.suggestedTitle ?? null,
      rationale: item.rationale ?? null,
      nextStep: item.nextStep ?? null
    })
  );
}

function remediationPackAuthority(source = {}) {
  return {
    id: source.id ?? null,
    clusterId: source.clusterId ?? null,
    acceptanceCriteria: normalizeStringArray(
      source.acceptanceCriteria
    ),
    manualNextActions: normalizeStringArray(
      source.manualNextActions
    ),
    conversionPaths: conversionPathAuthority(
      source.rankedConversionPaths
      ?? source.conversionHints
    ),
    reviewConcerns: normalizeAuthorityItems(
      source.reviewConcerns,
      (item) => ({
        id: item.id ?? null,
        summary: item.summary ?? null,
        status: item.status ?? null,
        severity: item.severity ?? null,
        responseOwnerRole: item.responseOwnerRole ?? null,
        linkedArtifactPaths: normalizeStringArray(
          item.linkedArtifactPaths
        ),
        linkedAuditIds: normalizeStringArray(
          item.linkedAuditIds
        ),
        linkedBridgeIds: normalizeStringArray(
          item.linkedBridgeIds
        )
      })
    ),
    figureQa: normalizeAuthorityItems(
      source.figureQa,
      (item) => ({
        id: item.id ?? null,
        figureId: item.figureId ?? null,
        code: item.code ?? null,
        summary: item.summary ?? null,
        severity: item.severity ?? null,
        artifactPaths: normalizeStringArray(
          item.artifactPaths
        )
      })
    )
  };
}

function operatorPlaybookAuthority(source = {}) {
  return {
    id: source.id ?? null,
    taxonomyFamilyId: source.taxonomyFamilyId ?? null,
    remediationPackIds: normalizeStringArray(
      source.remediationPackIds
    ),
    acceptanceCriteria: normalizeStringArray(
      source.acceptanceCriteria
    ),
    manualNextActions: normalizeStringArray(
      source.manualNextActions
    ),
    conversionPaths: conversionPathAuthority(
      source.rankedConversionPaths
      ?? source.conversionHints
    )
  };
}

function executionBridgeAuthority(source = {}) {
  return {
    id: source.id ?? null,
    candidateType: source.candidateType ?? null,
    targetArtifact: source.targetArtifact ?? null,
    targetId: source.targetId ?? null,
    suggestedTitle: source.suggestedTitle ?? null,
    suggestedSummary: source.suggestedSummary ?? null,
    suggestedNextStep: source.suggestedNextStep ?? null,
    suggestedAcceptanceCriteria: normalizeStringArray(
      source.suggestedAcceptanceCriteria
    ),
    sourceRemediationPackIds: normalizeStringArray(
      source.sourceRemediationPackIds
    ),
    sourcePlaybookIds: normalizeStringArray(
      source.sourcePlaybookIds
    ),
    sourceConversionPath: source.sourceConversionPath
      ? {
          targetType:
            source.sourceConversionPath.targetType ?? null,
          targetId:
            source.sourceConversionPath.targetId ?? null,
          assignedRole:
            source.sourceConversionPath.assignedRole ?? null
        }
      : null
  };
}

export function followThroughAuthorityState(
  item = {},
  operatingState = {}
) {
  const authorityStatuses = new Set([
    "accepted-for-execution",
    "executing",
    "accepted-risk"
  ]);
  if (!authorityStatuses.has(item.status)) {
    return { required: false, trusted: true, reason: null };
  }
  if (item.authorityProvenance !== "trusted-system-transition") {
    return {
      required: true,
      trusted: false,
      reason: "untrusted-authority-provenance"
    };
  }
  if (!item.programId || !item.programRunId || !item.approvalId) {
    return {
      required: true,
      trusted: false,
      reason: "missing-program-authority-lineage"
    };
  }

  const program = (operatingState.programs?.items ?? []).find(
    (candidate) => candidate.id === item.programId
  ) ?? null;
  const programRun = (operatingState.programRuns?.items ?? []).find(
    (candidate) => candidate.id === item.programRunId
  ) ?? null;
  const approval = (operatingState.programApprovals?.items ?? []).find(
    (candidate) => candidate.id === item.approvalId
  ) ?? null;
  if (!program || !programRun || !approval) {
    return {
      required: true,
      trusted: false,
      reason: "program-authority-not-found"
    };
  }
  if (
    programRun.programId !== program.id
    || programRun.approvalId !== approval.id
    || approval.programId !== program.id
    || approval.programRunId !== programRun.id
    || !programRun.linkedFollowThroughIds?.includes(item.id)
  ) {
    return {
      required: true,
      trusted: false,
      reason: "program-authority-lineage-mismatch"
    };
  }
  if (
    approval.status !== "approved"
    || !["approved", "active"].includes(programRun.status)
    || !["active", "planned"].includes(program.status)
    || (approval.expiresAt && Date.parse(approval.expiresAt) <= Date.now())
  ) {
    return {
      required: true,
      trusted: false,
      reason: "program-authority-inactive"
    };
  }

  const claim = approval.activeExecutionClaim ?? null;
  if (
    !claim
    || !["claimed", "applied"].includes(claim.status)
    || claim.followThroughId !== item.id
    || claim.packetId !== item.linkedTargetId
    || claim.sourceType !== item.sourceType
    || claim.sourceId !== item.sourceId
    || claim.sourceFingerprint !== item.sourceFingerprint
    || programRun.activeExecutionClaimId !== claim.claimId
  ) {
    return {
      required: true,
      trusted: false,
      reason: "runtime-authority-claim-mismatch"
    };
  }
  return { required: true, trusted: true, reason: null };
}

export function followThroughSourceAuthorityFingerprint(
  sourceType,
  source
) {
  let authority;
  if (sourceType === "remediation-pack") {
    authority = remediationPackAuthority(source);
  } else if (sourceType === "operator-playbook") {
    authority = operatorPlaybookAuthority(source);
  } else if (sourceType === "execution-bridge") {
    authority = executionBridgeAuthority(source);
  } else {
    throw new Error(
      `Unsupported follow-through authority source type: ${sourceType}.`
    );
  }
  return crypto
    .createHash("sha256")
    .update(stableJson({ sourceType, authority }))
    .digest("hex");
}
