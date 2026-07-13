import { runWithMutationContext } from "../../src/core/mutation-backend.mjs";
import { ensureWorkspace } from "../../src/core/workspace.mjs";

export function runFixtureMutation(root, actionId, callback) {
  return runWithMutationContext(root, {
    actionId: `test-fixture:${actionId}`,
    mutationMode: "direct-process",
    hostId: "test"
  }, callback);
}

export function ensureTestWorkspace(root) {
  return runFixtureMutation(root, "ensure-workspace", () => ensureWorkspace(root));
}
