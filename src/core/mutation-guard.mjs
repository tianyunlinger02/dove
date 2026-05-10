import {
  GOVERNANCE_EXEMPT_MUTATIONS,
  GOVERNANCE_GUARDED_MUTATIONS
} from "./schema.mjs";
import { assertResolvedTaskPacket } from "./task-packets.mjs";

const GOVERNANCE_MUTATION_BY_ID = new Map([
  ...GOVERNANCE_GUARDED_MUTATIONS,
  ...GOVERNANCE_EXEMPT_MUTATIONS
].map((entry) => [entry.id, entry]));

export function getGovernanceMutationEntry(actionId) {
  return GOVERNANCE_MUTATION_BY_ID.get(actionId) ?? null;
}

export function assertTaskScopedMutationTarget(root, actionId, args = {}, options = {}) {
  const entry = getGovernanceMutationEntry(actionId);
  if (!entry) {
    throw new Error(`Governance registry missing mutation entry: ${actionId}`);
  }
  if (!entry.requiresPacketTarget) {
    return {
      packet: null,
      packetId: null,
      resolution: {
        mode: "not-packet-scoped",
        mutationScope: entry.mutationScope ?? "unspecified"
      },
      artifactIds: []
    };
  }
  return assertResolvedTaskPacket(root, args, {
    ...options,
    targetFields: options.targetFields ?? entry.targetFields,
    artifactFields: options.artifactFields ?? entry.artifactFields,
    mutationScope: entry.mutationScope
  });
}
