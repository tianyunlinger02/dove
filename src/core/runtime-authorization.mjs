import crypto from "node:crypto";

import {
  ARTIFACT_PATHS,
  createMetaExecutionBridgeCandidatesIndex,
  createMetaOperatorPlaybooksIndex,
  createMetaRemediationPacksIndex,
  normalizeAutonomyAllowedStepType,
  normalizeMetaExecutionBridgeCandidatesIndex,
  normalizeMetaOperatorPlaybooksIndex,
  normalizeMetaRemediationPacksIndex
} from "./schema.mjs";
import { followThroughSourceAuthorityFingerprint } from "./follow-through-authority.mjs";
import { readProgramOperatingState } from "./program-operating-state.mjs";
import { nowIso, readJson } from "./workspace.mjs";

const CLAIM_SELECTOR_KEYS = new Set([
  "claimId",
  "runtimeRunId",
  "leaseId"
]);

function invalidAuthorization(actionLabel, reason) {
  throw new Error(
    `${actionLabel} requires a valid active runtime execution claim (${reason}).`
  );
}

function requireIdentifier(value, field, actionLabel) {
  const normalized =
    typeof value === "string"
      ? value.trim()
      : "";
  if (!normalized) {
    invalidAuthorization(
      actionLabel,
      `missing-${field}`
    );
  }
  return normalized;
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (
    value
    && typeof value === "object"
  ) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function authorizationFingerprint({
  programId,
  programRunId,
  approvalId,
  packetId,
  stepIndex,
  allowedStepType,
  stepPayload,
  authorityEnvelope
}) {
  return crypto
    .createHash("sha256")
    .update(stableJson({
      programId,
      programRunId,
      approvalId,
      packetId,
      stepIndex,
      allowedStepType,
      stepPayload,
      authorityEnvelope
    }))
    .digest("hex");
}

function currentFollowThroughSource(root, item) {
  if (item.sourceType === "remediation-pack") {
    const index = normalizeMetaRemediationPacksIndex(
      readJson(
        root,
        ARTIFACT_PATHS.metaRemediationPacks,
        createMetaRemediationPacksIndex
      )
    );
    const source = (index.packs ?? []).find(
      (candidate) => candidate.id === item.sourceId
    ) ?? null;
    return source
      ? {
          artifactPath: ARTIFACT_PATHS.metaRemediationPacks,
          fingerprint: followThroughSourceAuthorityFingerprint(
            "remediation-pack",
            source
          )
        }
      : null;
  }
  if (item.sourceType === "operator-playbook") {
    const index = normalizeMetaOperatorPlaybooksIndex(
      readJson(
        root,
        ARTIFACT_PATHS.metaOperatorPlaybooks,
        createMetaOperatorPlaybooksIndex
      )
    );
    const source = (index.playbooks ?? []).find(
      (candidate) => candidate.id === item.sourceId
    ) ?? null;
    return source
      ? {
          artifactPath: ARTIFACT_PATHS.metaOperatorPlaybooks,
          fingerprint: followThroughSourceAuthorityFingerprint(
            "operator-playbook",
            source
          )
        }
      : null;
  }
  if (item.sourceType === "execution-bridge") {
    const index = normalizeMetaExecutionBridgeCandidatesIndex(
      readJson(
        root,
        ARTIFACT_PATHS.metaExecutionBridgeCandidates,
        createMetaExecutionBridgeCandidatesIndex
      )
    );
    const source = (index.candidates ?? []).find(
      (candidate) => candidate.id === item.sourceId
    ) ?? null;
    return source
      ? {
          artifactPath: ARTIFACT_PATHS.metaExecutionBridgeCandidates,
          fingerprint: followThroughSourceAuthorityFingerprint(
            "execution-bridge",
            source
          )
        }
      : null;
  }
  return null;
}

function isIsoTimestamp(value) {
  return typeof value === "string"
    && value.trim().length > 0
    && !Number.isNaN(Date.parse(value));
}

function canonicalPacketPath(packetId) {
  return `${ARTIFACT_PATHS.taskPacketsPacketsDir}/${packetId}.json`;
}

function validateCurrentFollowThrough(
  root,
  {
    packet,
    program,
    programRun,
    approval,
    actorRole,
    followThroughItem
  },
  actionLabel
) {
  const followThroughId =
    packet.materialization?.followThroughId
    ?? null;
  if (
    !followThroughId
    || followThroughItem?.id !== followThroughId
    || !programRun.linkedFollowThroughIds
      ?.includes(followThroughId)
  ) {
    invalidAuthorization(
      actionLabel,
      "follow-through-linkage-mismatch"
    );
  }
  if (
    followThroughItem.programId !== program.id
    || followThroughItem.programRunId
      !== programRun.id
    || followThroughItem.approvalId !== approval.id
    || followThroughItem.linkedTargetArtifact
      !== packet.packetPath
    || followThroughItem.linkedTargetId !== packet.id
    || followThroughItem.actorRole !== actorRole
    || followThroughItem.actorRole
      !== programRun.controllerRole
    || followThroughItem.workerRole
      !== programRun.workerRole
    || followThroughItem.workerRole
      !== packet.assignedRole
  ) {
    invalidAuthorization(
      actionLabel,
      "follow-through-lineage-mismatch"
    );
  }
  if (
    followThroughItem.plannedTarget !== false
    || followThroughItem.targetBound !== true
  ) {
    invalidAuthorization(
      actionLabel,
      "follow-through-target-unbound"
    );
  }
  if (
    followThroughItem.invalidStatus === true
    || followThroughItem.stale === true
    || ![
      "accepted-for-execution",
      "executing"
    ].includes(followThroughItem.status)
  ) {
    invalidAuthorization(
      actionLabel,
      "follow-through-not-executable"
    );
  }
  const retryState = followThroughItem.retryState;
  if (
    !retryState
    || !Number.isInteger(retryState.attemptCount)
    || !Number.isInteger(retryState.maxAttempts)
    || retryState.attemptCount < 0
    || retryState.maxAttempts < 1
    || retryState.attemptCount > retryState.maxAttempts
    || (
      followThroughItem.status
        === "accepted-for-execution"
      && retryState.attemptCount
        >= retryState.maxAttempts
    )
    || retryState.escalatedAt != null
  ) {
    invalidAuthorization(
      actionLabel,
      "follow-through-retry-exhausted"
    );
  }
  if (
    !isIsoTimestamp(followThroughItem.executeBy)
    || !isIsoTimestamp(followThroughItem.reviewAfter)
    || (
      followThroughItem.status === "executing"
      && !isIsoTimestamp(
        followThroughItem.executionStartedAt
      )
    )
  ) {
    invalidAuthorization(
      actionLabel,
      "follow-through-window-invalid"
    );
  }
  const source = currentFollowThroughSource(
    root,
    followThroughItem
  );
  if (
    !source
    || followThroughItem.sourceArtifactPath
      !== source.artifactPath
    || followThroughItem.sourceFingerprint
      !== source.fingerprint
    || packet.materialization?.sourceType
      !== followThroughItem.sourceType
    || packet.materialization?.sourceId
      !== followThroughItem.sourceId
    || packet.materialization?.sourceArtifactPath
      !== source.artifactPath
    || packet.materialization?.sourceFingerprint
      !== source.fingerprint
  ) {
    invalidAuthorization(
      actionLabel,
      "follow-through-source-drift"
    );
  }
}

function loadProgramOperatingState(root) {
  return readProgramOperatingState(root);
}

function matchingAuthorityEnvelope(
  programRun,
  approval,
  actionLabel
) {
  const runEnvelope =
    programRun.authorityEnvelope ?? null;
  const approvalEnvelope =
    approval.authorityEnvelope ?? null;
  if (
    !runEnvelope
    || !approvalEnvelope
    || stableJson(runEnvelope)
      !== stableJson(approvalEnvelope)
  ) {
    invalidAuthorization(
      actionLabel,
      "authority-envelope-mismatch"
    );
  }
  const maxStepCount = Number(
    approvalEnvelope.maxStepCount
  );
  const consumedStepCount = Number(
    approvalEnvelope.consumedStepCount
  );
  const remainingStepCount = Number(
    approvalEnvelope.remainingStepCount
  );
  if (
    !Number.isInteger(maxStepCount)
    || !Number.isInteger(consumedStepCount)
    || !Number.isInteger(remainingStepCount)
    || maxStepCount < 1
    || consumedStepCount < 0
    || consumedStepCount > maxStepCount
    || remainingStepCount
      !== maxStepCount - consumedStepCount
  ) {
    invalidAuthorization(
      actionLabel,
      "authority-envelope-invalid"
    );
  }
  const currentStep =
    approvalEnvelope.stepSequence
      ?.[consumedStepCount]
    ?? null;
  if (!currentStep) {
    invalidAuthorization(
      actionLabel,
      "approval-exhausted"
    );
  }
  const allowedStepType =
    normalizeAutonomyAllowedStepType(
      currentStep.allowedStepType,
      null
    );
  if (!allowedStepType) {
    invalidAuthorization(
      actionLabel,
      "step-type-invalid"
    );
  }
  return {
    authorityEnvelope: approvalEnvelope,
    stepIndex: consumedStepCount,
    currentStep,
    allowedStepType,
    stepPayload:
      currentStep.stepPayload ?? null
  };
}

function validateDurableAuthorization(
  root,
  {
    programId,
    programRunId,
    approvalId,
    packetId,
    runtimeRunId,
    leaseId,
    actorRole
  },
  actionLabel
) {
  const state = loadProgramOperatingState(root);
  const program =
    (state.programs.items ?? []).find(
      (item) => item.id === programId
    ) ?? null;
  const programRun =
    (state.programRuns.items ?? []).find(
      (item) =>
        item.id === programRunId
        && item.programId === programId
        && item.approvalId === approvalId
    ) ?? null;
  const approval =
    (state.programApprovals.items ?? [])
      .find(
        (item) =>
          item.id === approvalId
          && item.programId === programId
          && item.programRunId
            === programRunId
      ) ?? null;
  const packetIndex = readJson(
    root,
    ARTIFACT_PATHS.taskPacketsIndex,
    { items: [] }
  );
  const packet =
    (packetIndex.items ?? []).find(
      (item) => item.id === packetId
    ) ?? null;
  const packetArtifact = readJson(
    root,
    canonicalPacketPath(packetId),
    null
  );
  const followThrough = readJson(
    root,
    ARTIFACT_PATHS.metaOperatorFollowThrough,
    { items: [] }
  );
  const followThroughId =
    packet?.materialization?.followThroughId
    ?? null;
  const followThroughItem =
    (followThrough.items ?? []).find(
      (item) => item.id === followThroughId
    ) ?? null;
  const runtimeLeases = readJson(
    root,
    ARTIFACT_PATHS.runtimeLeases,
    { items: [] }
  );
  const runtimeLease =
    (runtimeLeases.items ?? []).find(
      (item) =>
        item.id === leaseId
        && item.runId === runtimeRunId
        && item.packetId === packetId
        && item.actorRole === actorRole
        && item.status === "active"
        && (
          !item.expiresAt
          || String(item.expiresAt) > nowIso()
        )
    ) ?? null;

  if (
    !program
    || !programRun
    || !approval
    || !packet
    || !packetArtifact
  ) {
    invalidAuthorization(
      actionLabel,
      "durable-linkage-missing"
    );
  }
  if (!followThroughItem) {
    invalidAuthorization(
      actionLabel,
      "follow-through-not-executable"
    );
  }
  validateCurrentFollowThrough(
    root,
    {
      packet,
      program,
      programRun,
      approval,
      actorRole,
      followThroughItem
    },
    actionLabel
  );
  if (!runtimeLease) {
    invalidAuthorization(
      actionLabel,
      "active-runtime-lease-missing"
    );
  }
  if (approval.status !== "approved") {
    invalidAuthorization(
      actionLabel,
      "approval-not-approved"
    );
  }
  if (
    approval.expiresAt
    && String(approval.expiresAt) <= nowIso()
  ) {
    invalidAuthorization(
      actionLabel,
      "approval-expired"
    );
  }
  if (
    !["approved", "active"].includes(
      programRun.status
    )
  ) {
    invalidAuthorization(
      actionLabel,
      "program-run-not-active"
    );
  }
  if (
    programRun.reviewCheckpointRequired
    || programRun.status === "review-needed"
  ) {
    invalidAuthorization(
      actionLabel,
      "program-run-awaiting-review"
    );
  }
  if (
    !programRun.packetIds?.includes(packetId)
    || packet.packetPath
      !== canonicalPacketPath(packetId)
    || packet.id !== packetId
    || packetArtifact.id !== packetId
    || packetArtifact.packetPath
      !== packet.packetPath
    || packetArtifact.materialization
      ?.followThroughId
      !== packet.materialization
        ?.followThroughId
    || packetArtifact.lineage?.programId
      !== packet.lineage?.programId
    || packetArtifact.lineage?.programRunId
      !== packet.lineage?.programRunId
    || packetArtifact.lineage?.approvalId
      !== packet.lineage?.approvalId
  ) {
    invalidAuthorization(
      actionLabel,
      "program-run-packet-mismatch"
    );
  }
  if (programRun.controllerRole !== actorRole) {
    invalidAuthorization(
      actionLabel,
      "controller-role-mismatch"
    );
  }
  if (
    programRun.workerRole
    !== packet.assignedRole
  ) {
    invalidAuthorization(
      actionLabel,
      "worker-role-mismatch"
    );
  }
  const packetProgramId =
    packet.lineage?.programId
    ?? packet.materialization?.programId
    ?? null;
  const packetProgramRunId =
    packet.lineage?.programRunId
    ?? packet.materialization?.programRunId
    ?? null;
  const packetApprovalId =
    packet.lineage?.approvalId
    ?? packet.materialization?.approvalId
    ?? null;
  if (
    packetProgramId !== programId
    || packetProgramRunId !== programRunId
    || packetApprovalId !== approvalId
  ) {
    invalidAuthorization(
      actionLabel,
      "packet-authorization-mismatch"
    );
  }

  const matched = matchingAuthorityEnvelope(
    programRun,
    approval,
    actionLabel
  );
  return {
    state,
    program,
    programRun,
    approval,
    packet,
    followThroughItem,
    runtimeLease,
    ...matched,
    authorizationFingerprint:
      authorizationFingerprint({
        programId: program.id,
        programRunId: programRun.id,
        approvalId: approval.id,
        packetId: packet.id,
        stepIndex: matched.stepIndex,
        allowedStepType:
          matched.allowedStepType,
        stepPayload: matched.stepPayload,
        authorityEnvelope:
          matched.authorityEnvelope
      })
  };
}

export function resolveApprovedRuntimeStep(
  root,
  selectors
) {
  const actionLabel =
    "Approved runtime step";
  return validateDurableAuthorization(
    root,
    {
      programId: requireIdentifier(
        selectors?.programId,
        "programId",
        actionLabel
      ),
      programRunId: requireIdentifier(
        selectors?.programRunId,
        "programRunId",
        actionLabel
      ),
      approvalId: requireIdentifier(
        selectors?.approvalId,
        "approvalId",
        actionLabel
      ),
      packetId: requireIdentifier(
        selectors?.packetId,
        "packetId",
        actionLabel
      ),
      runtimeRunId: requireIdentifier(
        selectors?.runtimeRunId,
        "runtimeRunId",
        actionLabel
      ),
      leaseId: requireIdentifier(
        selectors?.leaseId,
        "leaseId",
        actionLabel
      ),
      actorRole: requireIdentifier(
        selectors?.actorRole,
        "actorRole",
        actionLabel
      )
    },
    actionLabel
  );
}

function validateClaimSelector(
  selector,
  actionLabel
) {
  const unknownKeys = Object.keys(
    selector ?? {}
  ).filter(
    (key) => !CLAIM_SELECTOR_KEYS.has(key)
  );
  if (unknownKeys.length > 0) {
    invalidAuthorization(
      actionLabel,
      `unknown-selector-fields:${unknownKeys.join(",")}`
    );
  }
  return {
    claimId: requireIdentifier(
      selector?.claimId,
      "claimId",
      actionLabel
    ),
    runtimeRunId: requireIdentifier(
      selector?.runtimeRunId,
      "runtimeRunId",
      actionLabel
    ),
    leaseId: requireIdentifier(
      selector?.leaseId,
      "leaseId",
      actionLabel
    )
  };
}

export function resolveClaimedRuntimeStep(
  root,
  selector,
  expectedStepType = null,
  actionLabel = "Runtime persistence"
) {
  const validatedSelector =
    validateClaimSelector(
      selector,
      actionLabel
    );
  const state = loadProgramOperatingState(root);
  const approval =
    (state.programApprovals.items ?? [])
      .find(
        (item) =>
          item.activeExecutionClaim?.claimId
            === validatedSelector.claimId
          && item.activeExecutionClaim
            ?.runtimeRunId
            === validatedSelector.runtimeRunId
          && item.activeExecutionClaim?.leaseId
            === validatedSelector.leaseId
      ) ?? null;
  if (!approval) {
    invalidAuthorization(
      actionLabel,
      "execution-claim-missing"
    );
  }
  const claim = approval.activeExecutionClaim;
  if (
    !["claimed", "applied"].includes(
      claim.status
    )
  ) {
    invalidAuthorization(
      actionLabel,
      "execution-claim-not-active"
    );
  }
  const validated =
    validateDurableAuthorization(
      root,
      {
        programId: approval.programId,
        programRunId:
          approval.programRunId,
        approvalId: approval.id,
        packetId: claim.packetId,
        runtimeRunId:
          validatedSelector.runtimeRunId,
        leaseId: validatedSelector.leaseId,
        actorRole: claim.actorRole
      },
      actionLabel
    );
  if (
    validated.programRun.activeExecutionClaimId
      !== validatedSelector.claimId
    || validated.stepIndex !== claim.stepIndex
    || validated.allowedStepType
      !== claim.allowedStepType
  ) {
    invalidAuthorization(
      actionLabel,
      "execution-claim-step-drift"
    );
  }
  if (
    expectedStepType
    && validated.allowedStepType
      !== expectedStepType
  ) {
    invalidAuthorization(
      actionLabel,
      "step-type-mismatch"
    );
  }
  const fingerprint =
    authorizationFingerprint({
      programId: validated.program.id,
      programRunId: validated.programRun.id,
      approvalId: validated.approval.id,
      packetId: validated.packet.id,
      stepIndex: validated.stepIndex,
      allowedStepType:
        validated.allowedStepType,
      stepPayload: validated.stepPayload,
      authorityEnvelope:
        validated.authorityEnvelope
    });
  if (
    fingerprint
    !== claim.authorizationFingerprint
  ) {
    invalidAuthorization(
      actionLabel,
      "execution-claim-fingerprint-mismatch"
    );
  }
  return {
    ...validated,
    claim,
    selector: validatedSelector,
    authorizationProvenance: {
      kind:
        "validated-program-authorization",
      programId: validated.program.id,
      programRunId: validated.programRun.id,
      approvalId: validated.approval.id,
      packetId: validated.packet.id,
      allowedStepType:
        validated.allowedStepType,
      authorityStepIndex:
        validated.stepIndex,
      authorityStepId:
        validatedSelector.claimId,
      executionClaimId:
        validatedSelector.claimId,
      runtimeRunId:
        validatedSelector.runtimeRunId,
      leaseId:
        validatedSelector.leaseId
    }
  };
}
