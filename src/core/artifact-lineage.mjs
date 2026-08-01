import { readExecutionReceiptLedger } from "./receipt-ledger.mjs";
import { openDoveWorkspace } from "./workspace-schema.mjs";

export function readArtifactLedger(root) {
  const workspace = openDoveWorkspace(root, { operation: "Artifact receipt ledger read" });
  return workspace.receiptLedger;
}

export function readArtifactOwnership(root) {
  const ledger = readArtifactLedger(root);
  return {
    schemaVersion: ledger.schemaVersion,
    workspaceId: ledger.workspaceId,
    artifacts: ledger.currentOwnership,
    updatedAt: ledger.updatedAt
  };
}

export function readArtifactHistory(root) {
  return readArtifactLedger(root).artifactHistory;
}

export { readExecutionReceiptLedger };
